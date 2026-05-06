/**
 * Phase 1–3 — server-only secret envelope (integration tokens).
 * slv1: legacy single-key AES-256-GCM blob (IV+tag+ciphertext).
 * env1: envelope encryption (DEK + master key) with key versioning.
 * Uses ENCRYPTION_KEY (32-byte base64 or raw string); never log plaintext.
 * Optional ENCRYPTION_KEY_PREVIOUS enables decrypt during key rotation (dual-read).
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { env } from "@/lib/env";
import type { Env1Envelope, SecretPurpose } from "@/lib/server/encryption/secret-types";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const SALT = "solvren-p1-crypto-v1";

export const ENV1_PREFIX = "env1:";
export const SLV1_PREFIX = "slv1:";

function rawKeyToBytes(raw: string): Buffer {
  const t = raw.trim();
  if (t.length >= 44 && /^[A-Za-z0-9+/]+=*$/.test(t)) {
    const b = Buffer.from(t, "base64");
    if (b.length === 32) return b;
  }
  return scryptSync(t, SALT, 32);
}

/** Primary key only — all new ciphertext uses this. */
export function integrationKeyBytesForEncrypt(): Buffer {
  const raw = env.integrationEncryptionKey;
  if (!raw?.trim()) {
    throw new Error("ENCRYPTION_KEY is not configured");
  }
  return rawKeyToBytes(raw);
}

/**
 * Ordered list for decrypt: primary first, then previous (rotation / dual-read).
 * Deduplicates identical key material.
 */
export function integrationKeyBytesForDecrypt(): Buffer[] {
  const keys: Buffer[] = [];
  const seen = new Set<string>();
  for (const raw of [env.integrationEncryptionKey, env.integrationEncryptionKeyPrevious]) {
    if (!raw?.trim()) continue;
    const b = rawKeyToBytes(raw);
    const id = b.toString("base64");
    if (!seen.has(id)) {
      seen.add(id);
      keys.push(b);
    }
  }
  return keys;
}

function encryptWithKey(plaintext: string, key: Buffer): { ct: string; iv: string; at: string } {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ct: enc.toString("base64"),
    iv: iv.toString("base64"),
    at: tag.toString("base64"),
  };
}

function decryptWithKeyParts(ctB64: string, ivB64: string, atB64: string, key: Buffer): string {
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(atB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
}

/** Legacy slv1 inner blob: single-key encrypt (IV || tag || ciphertext, base64). */
export function encryptSecret(plaintext: string): string {
  const key = integrationKeyBytesForEncrypt();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function getActiveKeyVersion(): string {
  return (process.env.SOLVREN_ACTIVE_KEY_VERSION ?? "v1").trim();
}

function masterKeyBytesForEnvelopeVersion(version: string): Buffer {
  const v = version.trim() || "v1";
  if (v === "v1") {
    return integrationKeyBytesForEncrypt();
  }
  throw new Error(`Unsupported envelope key version: ${v}`);
}

/** Full stored token: env1:<base64 json envelope>. */
export function encryptEnv1EnvelopeString(plaintext: string, purpose?: SecretPurpose): string {
  if (!plaintext) throw new Error("Cannot encrypt empty secret");
  const dek = randomBytes(32);
  const kv = getActiveKeyVersion();
  const master = masterKeyBytesForEnvelopeVersion(kv);
  const body = encryptWithKey(plaintext, dek);
  const dekWrapped = encryptWithKey(dek.toString("base64"), master);
  const envelope: Env1Envelope = {
    v: 1,
    alg: "AES-256-GCM",
    kv,
    purpose,
    ct: body.ct,
    iv: body.iv,
    at: body.at,
    edk: dekWrapped.ct,
    div: dekWrapped.iv,
    dat: dekWrapped.at,
    createdAt: new Date().toISOString(),
  };
  return `${ENV1_PREFIX}${Buffer.from(JSON.stringify(envelope)).toString("base64")}`;
}

function decryptEnv1Payload(jsonB64: string): string {
  const env = JSON.parse(Buffer.from(jsonB64, "base64").toString("utf8")) as Env1Envelope;
  if (env.v !== 1 || env.alg !== "AES-256-GCM") {
    throw new Error("Unsupported env1 envelope");
  }
  const master = masterKeyBytesForEnvelopeVersion(env.kv);
  const dekB64 = decryptWithKeyParts(env.edk, env.div, env.dat, master);
  const dek = Buffer.from(dekB64, "base64");
  return decryptWithKeyParts(env.ct, env.iv, env.at, dek);
}

export function decryptSecretWithKeyBytes(ciphertextB64: string, key: Buffer): string {
  const buf = Buffer.from(ciphertextB64, "base64");
  if (buf.length < IV_LEN + 16) {
    throw new Error("Invalid ciphertext");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + 16);
  const data = buf.subarray(IV_LEN + 16);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** Try each key until AES-GCM auth succeeds (rotation without downtime). */
export function decryptSecretWithAnyKey(ciphertextB64: string, keys: Buffer[]): string {
  let last: Error | undefined;
  for (const key of keys) {
    try {
      return decryptSecretWithKeyBytes(ciphertextB64, key);
    } catch (e) {
      last = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw last ?? new Error("Invalid ciphertext");
}

/** Decrypt using ENCRYPTION_KEY (+ ENCRYPTION_KEY_PREVIOUS if set). */
export function decryptSecret(ciphertextB64: string): string {
  const keys = integrationKeyBytesForDecrypt();
  if (keys.length === 0) {
    throw new Error("ENCRYPTION_KEY is not configured");
  }
  return decryptSecretWithAnyKey(ciphertextB64, keys);
}

/**
 * Decrypt slv1 inner blob, env1 envelope string, or legacy raw AES blob (no prefix).
 * Plaintext (no encryption markers) returned as-is.
 */
export function decryptAnyStoredSecretFormat(stored: string): string {
  const s = stored.trim();
  if (s.startsWith(ENV1_PREFIX)) {
    return decryptEnv1Payload(s.slice(ENV1_PREFIX.length));
  }
  if (s.startsWith(SLV1_PREFIX)) {
    const inner = s.slice(SLV1_PREFIX.length);
    const keys = integrationKeyBytesForDecrypt();
    if (keys.length === 0) throw new Error("ENCRYPTION_KEY is not configured");
    return decryptSecretWithAnyKey(inner, keys);
  }
  const keys = integrationKeyBytesForDecrypt();
  if (keys.length === 0) {
    return s;
  }
  if (/^[A-Za-z0-9+/]+=*$/.test(s) && s.length > 40) {
    try {
      return decryptSecretWithAnyKey(s, keys);
    } catch {
      /* fall through */
    }
  }
  return s;
}
