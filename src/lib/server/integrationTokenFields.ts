/**
 * At-rest encryption for integration_credentials token columns (Phase 1 production).
 * Legacy plaintext rows (no prefix) still decrypt as-is. New writes use slv1 envelope when ENCRYPTION_KEY is set.
 */
import { encryptSecret, decryptSecret } from "@/lib/server/crypto";
import { env } from "@/lib/env";

const PREFIX = "slv1:";

function encryptionRequired(): boolean {
  return Boolean(env.integrationEncryptionKey?.trim());
}

/** Decrypting slv1:* may use ENCRYPTION_KEY and/or ENCRYPTION_KEY_PREVIOUS. */
function canDecryptSlv1(): boolean {
  return Boolean(env.integrationEncryptionKey?.trim() || env.integrationEncryptionKeyPrevious?.trim());
}

/** Persist token / secret field; returns null for nullish input. */
export function sealIntegrationToken(plaintext: string | null | undefined): string | null {
  if (plaintext == null || plaintext === "") return null;
  if (!encryptionRequired()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "ENCRYPTION_KEY must be set in production before storing integration tokens"
      );
    }
    return plaintext;
  }
  return `${PREFIX}${encryptSecret(plaintext)}`;
}

/** Read token from DB — transparently decrypts slv1:* payloads. */
export function revealIntegrationToken(stored: string | null | undefined): string | null {
  if (stored == null || stored === "") return null;
  if (stored.startsWith(PREFIX)) {
    if (!canDecryptSlv1()) {
      throw new Error(
        "ENCRYPTION_KEY or ENCRYPTION_KEY_PREVIOUS required to decrypt slv1 integration tokens"
      );
    }
    return decryptSecret(stored.slice(PREFIX.length));
  }
  return stored;
}

/** Map credential row fields after load from DB. */
export function revealCredentialTokenFields<T extends Record<string, unknown>>(row: T): T {
  const keys = [
    "access_token",
    "refresh_token",
    "client_secret",
    "private_app_token",
    "jwt_private_key_base64",
  ] as const;
  const out = { ...row };
  for (const k of keys) {
    if (typeof out[k] === "string") {
      (out as Record<string, unknown>)[k] = revealIntegrationToken(out[k] as string);
    }
  }
  return out;
}

/** Prepare object for integration_credentials upsert/update. */
export function sealCredentialTokenFields(row: Record<string, unknown>): Record<string, unknown> {
  const out = { ...row };
  for (const k of [
    "access_token",
    "refresh_token",
    "client_secret",
    "private_app_token",
    "jwt_private_key_base64",
  ] as const) {
    if (k in out && typeof out[k] === "string") {
      out[k] = sealIntegrationToken(out[k] as string);
    }
  }
  return out;
}
