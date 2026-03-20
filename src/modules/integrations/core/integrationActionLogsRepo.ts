/**
 * Phase 1 — integration_action_logs persistence (§8.8, §20.3).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type IntegrationActionLogRow = {
  id: string;
  integration_account_id: string;
  provider: string;
  issue_id: string | null;
  action_type: string;
  target_ref_json: Record<string, unknown>;
  request_json: Record<string, unknown>;
  response_json: Record<string, unknown>;
  status: string;
  retry_count: number;
  executed_by_user_id: string | null;
  executed_at: string | null;
  created_at: string;
};

export async function insertActionLog(
  supabase: SupabaseClient,
  row: Omit<IntegrationActionLogRow, "id" | "created_at">
): Promise<{ data: IntegrationActionLogRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("integration_action_logs")
    .insert(row)
    .select()
    .single();
  return { data: data as IntegrationActionLogRow | null, error: error as Error | null };
}

export async function getActionLogsByAccountId(
  supabase: SupabaseClient,
  integrationAccountId: string,
  limit = 20
): Promise<{ data: IntegrationActionLogRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("integration_action_logs")
    .select("*")
    .eq("integration_account_id", integrationAccountId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return { data: (data ?? []) as IntegrationActionLogRow[], error: error as Error | null };
}
