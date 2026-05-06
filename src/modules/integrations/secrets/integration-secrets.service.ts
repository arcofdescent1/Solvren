/**
 * Phase 3 — Centralized decrypt + audit for integration secrets.
 */
import { decryptAnyStoredSecretFormat, ENV1_PREFIX, SLV1_PREFIX, encryptEnv1EnvelopeString } from "@/lib/server/crypto";
import { auditSecretAccessFireAndForget } from "@/lib/server/encryption/secret-audit";
import type {
  CredentialRevealAudit,
  CredentialRevealContext,
  SecretAccessReason,
} from "@/lib/server/encryption/secret-types";

export type { CredentialRevealAudit, CredentialRevealContext } from "@/lib/server/encryption/secret-types";
export type { ActorType, SecretAccessReason, SecretPurpose } from "@/lib/server/encryption/secret-types";

export function systemCredentialReveal(
  orgId: string,
  provider: string,
  reason: SecretAccessReason = "provider_api_call",
  integrationAccountId?: string | null,
): CredentialRevealContext {
  return {
    orgId,
    provider,
    actor: "system",
    actorId: null,
    reason,
    integrationAccountId: integrationAccountId ?? null,
  };
}

export function userCredentialReveal(
  orgId: string,
  provider: string,
  actorId: string,
  reason: SecretAccessReason = "manual_retry",
): CredentialRevealContext {
  return {
    orgId,
    provider,
    actor: "user",
    actorId,
    reason,
    integrationAccountId: null,
  };
}

/** Encrypt new integration token for DB (env1 envelope). */
export function encryptSecretForIntegrationStorage(plaintext: string): string {
  return encryptEnv1EnvelopeString(plaintext);
}

export function decryptStoredSecretWithAudit(
  stored: string | null | undefined,
  audit: CredentialRevealAudit,
): string | null {
  if (stored == null || stored === "") return null;
  const t = stored.trim();
  const plaintext = decryptAnyStoredSecretFormat(stored);

  if (t.startsWith(ENV1_PREFIX) || t.startsWith(SLV1_PREFIX)) {
    auditSecretAccessFireAndForget({
      orgId: audit.orgId,
      integrationAccountId: audit.integrationAccountId ?? null,
      secretField: audit.secretField,
      actor: audit.actor,
      actorId: audit.actorId ?? null,
      reason: audit.reason,
      accessContext: audit.provider,
    });
  }

  return plaintext;
}

/** Webhook / ad-hoc ciphertext — always audited (no legacy plaintext in this path). */
export function decryptAdhocSecretWithAudit(
  stored: string | null | undefined,
  audit: CredentialRevealAudit,
): string | null {
  if (stored == null || stored === "") return null;
  const plaintext = decryptAnyStoredSecretFormat(stored);
  auditSecretAccessFireAndForget({
    orgId: audit.orgId,
    integrationAccountId: audit.integrationAccountId ?? null,
    secretField: audit.secretField,
    actor: audit.actor,
    actorId: audit.actorId ?? null,
    reason: audit.reason,
    accessContext: audit.provider,
  });
  return plaintext;
}
