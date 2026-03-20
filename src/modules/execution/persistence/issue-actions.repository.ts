/**
 * Phase 6 — issue_actions persistence (§14).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type IssueActionRow = {
  id: string;
  issue_id: string;
  action_type: string;
  action_status: string;
  requested_by: string | null;
  external_system: string | null;
  target_ref: string | null;
  request_json: Record<string, unknown> | null;
  response_json: Record<string, unknown> | null;
  error_json: Record<string, unknown> | null;
  created_at: string;
  executed_at: string | null;
};

export async function insertIssueAction(
  supabase: SupabaseClient,
  row: Omit<IssueActionRow, "id">
): Promise<{ data: IssueActionRow | null; error: Error | null }> {
  const { data, error } = await supabase.from("issue_actions").insert(row).select().single();
  return { data: data as IssueActionRow | null, error: error as Error | null };
}

export async function listIssueActions(
  supabase: SupabaseClient,
  issueId: string
): Promise<{ data: IssueActionRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("issue_actions")
    .select("*")
    .eq("issue_id", issueId)
    .order("created_at", { ascending: false });
  return { data: (data ?? []) as IssueActionRow[], error: error as Error | null };
}
