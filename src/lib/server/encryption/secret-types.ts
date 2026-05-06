/**
 * Phase 3 — Secret encryption / audit types.
 */

export type EncryptionAlgorithm = "AES-256-GCM";

export type SecretPurpose =
  | "integration_oauth_access_token"
  | "integration_oauth_refresh_token"
  | "integration_api_key"
  | "integration_webhook_secret"
  | "integration_client_secret"
  | "database_connection_secret"
  | "external_action_signing_secret";

export type ActorType = "system" | "user" | "employee";

export type SecretAccessReason =
  | "provider_api_call"
  | "oauth_refresh"
  | "webhook_verification"
  | "scheduled_sync"
  | "manual_retry"
  | "debug_with_approval";

/** env1 envelope JSON (stored after env1: prefix as base64 JSON). */
export type Env1Envelope = {
  v: 1;
  alg: EncryptionAlgorithm;
  kv: string;
  purpose?: SecretPurpose;
  ct: string;
  iv: string;
  at: string;
  edk: string;
  div: string;
  dat: string;
  createdAt?: string;
};

export type CredentialRevealAudit = {
  orgId: string;
  provider: string;
  integrationAccountId?: string | null;
  secretField: string;
  actor: ActorType;
  actorId?: string | null;
  reason: SecretAccessReason;
};

/** Per-row context for `revealCredentialTokenFields` (secret field applied per column). */
export type CredentialRevealContext = Omit<CredentialRevealAudit, "secretField">;
