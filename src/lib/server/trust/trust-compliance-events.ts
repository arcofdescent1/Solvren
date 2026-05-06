/**
 * Phase 5 — Append-only trust events for log-backed buyer metrics.
 */
import { createPrivilegedClient } from "@/lib/server/adminClient";

export type TrustComplianceEventType =
  | "ingestion_job_success"
  | "ingestion_job_failed"
  | "redaction_validation_passed"
  | "raw_payload_policy_blocked"
  | "write_back_denied"
  | "privacy_downgrade_completed"
  | "privacy_downgrade_failed";

export async function recordTrustComplianceEvent(input: {
  orgId: string;
  eventType: TrustComplianceEventType;
  provider?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const admin = createPrivilegedClient("trust_compliance_events: append");
  const { error } = await admin.from("trust_compliance_events").insert({
    org_id: input.orgId,
    event_type: input.eventType,
    provider: input.provider ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) {
    console.error("[trust_compliance_events]", error.message);
  }
}
