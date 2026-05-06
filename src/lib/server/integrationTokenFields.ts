/**
 * At-rest encryption for integration_credentials token columns.
 * Legacy: slv1: single-key blob. Phase 3: env1: envelope (DEK + master key).
 */
import { encryptEnv1EnvelopeString, decryptAnyStoredSecretFormat, ENV1_PREFIX } from "@/lib/server/crypto";
import { decryptStoredSecretWithAudit } from "@/modules/integrations/secrets/integration-secrets.service";
import type { CredentialRevealAudit, CredentialRevealContext } from "@/lib/server/encryption/secret-types";
import { env } from "@/lib/env";

function encryptionRequired(): boolean {
  return Boolean(env.integrationEncryptionKey?.trim());
}

function canDecrypt(): boolean {
  return Boolean(env.integrationEncryptionKey?.trim() || env.integrationEncryptionKeyPrevious?.trim());
}

/** Persist token / secret field; returns null for nullish input. */
export function sealIntegrationToken(plaintext: string | null | undefined): string | null {
  if (plaintext == null || plaintext === "") return null;
  if (!encryptionRequired()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ENCRYPTION_KEY must be set in production before storing integration tokens");
    }
    return plaintext;
  }
  return encryptEnv1EnvelopeString(plaintext);
}

/**
 * Read token from DB — decrypts env1: and slv1: payloads; audits encrypted formats.
 * For legacy plaintext rows, returns as-is without audit.
 */
export function revealIntegrationToken(
  stored: string | null | undefined,
  audit: CredentialRevealAudit,
): string | null {
  if (stored == null || stored === "") return null;
  const s = stored.trim();
  if (s.startsWith("env1:") || s.startsWith("slv1:")) {
    if (!canDecrypt()) {
      throw new Error("ENCRYPTION_KEY or ENCRYPTION_KEY_PREVIOUS required to decrypt integration tokens");
    }
    return decryptStoredSecretWithAudit(s, audit);
  }
  return decryptAnyStoredSecretFormat(s);
}

export type { CredentialRevealContext } from "@/lib/server/encryption/secret-types";

/** Map credential row fields after load from DB (audited per field). */
export function revealCredentialTokenFields<T extends Record<string, unknown>>(
  row: T,
  auditBase: CredentialRevealContext,
): T {
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
      (out as Record<string, unknown>)[k] = revealIntegrationToken(out[k] as string, {
        ...auditBase,
        secretField: k,
      });
    }
  }
  return out;
}

/** Prepare object for integration_credentials upsert/update. */
export function sealCredentialTokenFields(row: Record<string, unknown>): Record<string, unknown> {
  const out = { ...row };
  let wroteEnv1 = false;
  for (const k of [
    "access_token",
    "refresh_token",
    "client_secret",
    "private_app_token",
    "jwt_private_key_base64",
  ] as const) {
    if (k in out && typeof out[k] === "string") {
      const sealed = sealIntegrationToken(out[k] as string);
      out[k] = sealed;
      if (typeof sealed === "string" && sealed.startsWith(ENV1_PREFIX)) wroteEnv1 = true;
    }
  }
  if (wroteEnv1) {
    if (!("secret_status" in out)) out.secret_status = "encrypted";
    out.encryption_version = process.env.SOLVREN_ACTIVE_KEY_VERSION ?? "v1";
    out.credentials_encrypted_at = new Date().toISOString();
  }
  return out;
}
