/**
 * Phase 1 — server-only secret envelope (integration tokens).
 * Uses ENCRYPTION_KEY (32-byte base64 or raw string); never log plaintext.
 * Optional ENCRYPTION_KEY_PREVIOUS enables decrypt during key rotation (dual-read).
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { env } from "@/lib/env";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const SALT = "solvren-p1-crypto-v1";

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

export function encryptSecret(plaintext: string): string {
  const key = integrationKeyBytesForEncrypt();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
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
