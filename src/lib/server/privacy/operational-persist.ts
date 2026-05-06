/**
 * Phase 5 — Choke-point assertion before persisting operational / normalized ingestion rows.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrgPrivacySettings } from "@/lib/server/privacy/org-privacy";
import { assertPrivacyPolicy, PrivacyPolicyError } from "@/lib/server/privacy/privacy-policy";
import { recordTrustComplianceEvent } from "@/lib/server/trust/trust-compliance-events";

export class OrgPrivacyNotFoundError extends Error {
  constructor() {
    super("Organization not found for privacy enforcement");
    this.name = "OrgPrivacyNotFoundError";
  }
}

export async function assertOperationalIngestPersistAllowed(
  supabase: SupabaseClient,
  orgId: string
): Promise<void> {
  if (!orgId || orgId === "__no_org__") return;

  const settings = await getOrgPrivacySettings(supabase, orgId);
  if (!settings) throw new OrgPrivacyNotFoundError();

  try {
    assertPrivacyPolicy({
      mode: settings.privacyMode,
      dataClass: "operational_event",
      action: "persist",
    });
  } catch (e) {
    if (e instanceof PrivacyPolicyError) {
      await recordTrustComplianceEvent({
        orgId,
        eventType: "raw_payload_policy_blocked",
        metadata: { reason: e.message, boundary: "operational_persist" },
      });
    }
    throw e;
  }
}

export async function assertFinancialEstimatePersistAllowed(
  supabase: SupabaseClient,
  orgId: string
): Promise<void> {
  const settings = await getOrgPrivacySettings(supabase, orgId);
  if (!settings) throw new OrgPrivacyNotFoundError();
  assertPrivacyPolicy({
    mode: settings.privacyMode,
    dataClass: "financial_estimated",
    action: "persist",
  });
}

export async function assertLlmOperationalPromptAllowed(
  supabase: SupabaseClient,
  orgId: string
): Promise<void> {
  if (!orgId) throw new OrgPrivacyNotFoundError();
  const settings = await getOrgPrivacySettings(supabase, orgId);
  if (!settings) throw new OrgPrivacyNotFoundError();
  assertPrivacyPolicy({
    mode: settings.privacyMode,
    dataClass: "operational_event",
    action: "prompt",
  });
  assertPrivacyPolicy({
    mode: settings.privacyMode,
    dataClass: "financial_estimated",
    action: "prompt",
  });
}
