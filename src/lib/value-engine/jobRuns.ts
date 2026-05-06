import type { SupabaseClient } from "@supabase/supabase-js";
import { recordTrustComplianceEvent } from "@/lib/server/trust/trust-compliance-events";

export async function logJobRun(
  supabase: SupabaseClient,
  row: {
    orgId: string | null;
    jobType: "ingestion" | "detection";
    integrationProvider?: string | null;
    success: boolean;
    errorMessage?: string | null;
  }
): Promise<void> {
  await supabase.from("value_engine_job_runs").insert({
    org_id: row.orgId,
    job_type: row.jobType,
    integration_provider: row.integrationProvider ?? null,
    completed_at: new Date().toISOString(),
    success: row.success,
    error_message: row.errorMessage ?? null,
  });

  if (row.orgId && row.jobType === "ingestion") {
    if (row.success) {
      void recordTrustComplianceEvent({
        orgId: row.orgId,
        eventType: "ingestion_job_success",
        provider: row.integrationProvider ?? null,
      });
      void recordTrustComplianceEvent({
        orgId: row.orgId,
        eventType: "redaction_validation_passed",
        provider: row.integrationProvider ?? null,
        metadata: { via: "value_engine_job_runs" },
      });
    } else {
      void recordTrustComplianceEvent({
        orgId: row.orgId,
        eventType: "ingestion_job_failed",
        provider: row.integrationProvider ?? null,
        metadata: { error: row.errorMessage ?? null },
      });
    }
  }
}
