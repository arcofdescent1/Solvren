/**
 * Phase 1 — integration credential envelope helpers.
 * Persist ciphertext only; decrypt only via audited paths (Phase 3).
 */
import { encryptSecret } from "@/lib/server/crypto";
import type { CredentialRevealAudit } from "@/lib/server/encryption/secret-types";
import { decryptAdhocSecretWithAudit } from "@/modules/integrations/secrets/integration-secrets.service";

export type StoredIntegrationSecret = {
  ciphertext: string;
  key_version: number;
  expires_at?: string | null;
};

export function sealIntegrationSecret(plaintext: string, keyVersion = 1): StoredIntegrationSecret {
  return {
    ciphertext: encryptSecret(plaintext),
    key_version: keyVersion,
    expires_at: null,
  };
}

export function openIntegrationSecret(stored: StoredIntegrationSecret, audit: CredentialRevealAudit): string {
  const p = decryptAdhocSecretWithAudit(stored.ciphertext, audit);
  if (p == null) throw new Error("Missing ciphertext");
  return p;
}
