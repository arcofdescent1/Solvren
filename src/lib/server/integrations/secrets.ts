/**
 * Phase 1 — integration credential envelope helpers.
 * Persist ciphertext only; decrypt only in trusted server integration services.
 */
import { encryptSecret, decryptSecret } from "@/lib/server/crypto";

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

export function openIntegrationSecret(stored: StoredIntegrationSecret): string {
  return decryptSecret(stored.ciphertext);
}
