import type { SupabaseClient } from "@supabase/supabase-js";

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
}
