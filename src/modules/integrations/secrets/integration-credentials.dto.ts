/**
 * Public-safe shapes for integration credentials — never return raw tokens or ciphertext to clients.
 */
export function mapIntegrationCredentialsToPublicDTO(record: Record<string, unknown> | null | undefined): {
  orgId: string | null;
  provider: string | null;
  integrationAccountId: string | null;
  hasCredentialMaterial: boolean;
  secretStatus: string | null;
  encryptionVersion: string | null;
  credentialsEncryptedAt: string | null;
} | null {
  if (!record) return null;
  const orgId = (record.org_id as string | undefined) ?? null;
  const provider = (record.provider as string | undefined) ?? null;
  const integrationAccountId = (record.integration_account_id as string | undefined) ?? null;
  const hasCredentialMaterial = Boolean(record.credentials_encrypted ?? record.secret_ref ?? record.access_token);
  return {
    orgId,
    provider,
    integrationAccountId,
    hasCredentialMaterial,
    secretStatus: (record.secret_status as string | undefined) ?? null,
    encryptionVersion: (record.encryption_version as string | undefined) ?? null,
    credentialsEncryptedAt: (record.credentials_encrypted_at as string | undefined) ?? null,
  };
}
