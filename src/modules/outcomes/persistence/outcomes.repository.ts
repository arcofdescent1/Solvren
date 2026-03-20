/**
 * Phase 7 — outcomes persistence.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OutcomeRow } from "../domain";

export async function insertOutcome(
  supabase: SupabaseClient,
  row: Omit<OutcomeRow, "id" | "created_at">
): Promise<{ data: OutcomeRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("outcomes")
    .insert(row)
    .select()
    .single();
  return { data: data as OutcomeRow | null, error: error as Error | null };
}

export async function listOutcomesForIssue(
  supabase: SupabaseClient,
  issueId: string
): Promise<{ data: OutcomeRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("outcomes")
    .select("*")
    .eq("issue_id", issueId)
    .order("created_at", { ascending: false });
  return { data: (data ?? []) as OutcomeRow[], error: error as Error | null };
}

export async function listOutcomesForOrg(
  supabase: SupabaseClient,
  orgId: string,
  params?: { since?: string; limit?: number }
): Promise<{ data: OutcomeRow[]; error: Error | null }> {
  let q = supabase.from("outcomes").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
  if (params?.since) q = q.gte("created_at", params.since);
  const limit = Math.min(params?.limit ?? 100, 500);
  q = q.limit(limit);
  const { data, error } = await q;
  return { data: (data ?? []) as OutcomeRow[], error: error as Error | null };
}
