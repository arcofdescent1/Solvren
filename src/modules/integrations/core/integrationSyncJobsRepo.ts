/**
 * Phase 1 — integration_sync_jobs persistence (§8.5, §20.3).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SyncJobStatus } from "../contracts/types";

export type IntegrationSyncJobRow = {
  id: string;
  integration_account_id: string;
  job_type: string;
  job_scope: string | null;
  status: SyncJobStatus;
  trigger_source: string;
  cursor_json: Record<string, unknown>;
  request_json: Record<string, unknown>;
  metrics_json: Record<string, unknown>;
  result_json: Record<string, unknown>;
  error_json: unknown;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export async function insertSyncJob(
  supabase: SupabaseClient,
  row: Omit<IntegrationSyncJobRow, "id" | "created_at">
): Promise<{ data: IntegrationSyncJobRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("integration_sync_jobs")
    .insert(row)
    .select()
    .single();
  return { data: data as IntegrationSyncJobRow | null, error: error as Error | null };
}

export async function getSyncJobsByAccountId(
  supabase: SupabaseClient,
  integrationAccountId: string,
  limit = 20
): Promise<{ data: IntegrationSyncJobRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("integration_sync_jobs")
    .select("*")
    .eq("integration_account_id", integrationAccountId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return { data: (data ?? []) as IntegrationSyncJobRow[], error: error as Error | null };
}

export async function updateSyncJob(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<Pick<IntegrationSyncJobRow, "status" | "cursor_json" | "metrics_json" | "result_json" | "error_json" | "started_at" | "completed_at">>
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("integration_sync_jobs").update(updates).eq("id", id);
  return { error: error as Error | null };
}
