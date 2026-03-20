/**
 * Phase 5 — Action performance stats repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type ActionPerformanceStatRow = {
  id: string;
  org_id: string | null;
  action_key: string;
  issue_family: string | null;
  sample_count: number;
  success_count: number;
  failure_count: number;
  avg_time_to_success_seconds: number | null;
  avg_recovered_amount: number | null;
  avg_avoided_amount: number | null;
  stat_window_start: string | null;
  stat_window_end: string | null;
  updated_at: string;
};

export async function getActionPerformanceStats(
  supabase: SupabaseClient,
  orgId: string,
  actionKey: string,
  issueFamily?: string | null
): Promise<{ data: ActionPerformanceStatRow | null; error: Error | null }> {
  const { data: rows, error } = await supabase
    .from("action_performance_stats")
    .select("*")
    .eq("action_key", actionKey)
    .or(`org_id.is.null,org_id.eq.${orgId}`)
    .order("sample_count", { ascending: false })
    .limit(5);

  if (error) return { data: null, error: error as Error };
  const list = (rows ?? []) as ActionPerformanceStatRow[];

  const pick = (): ActionPerformanceStatRow | null => {
    if (issueFamily) {
      const orgFamily = list.find((r) => r.org_id === orgId && r.issue_family === issueFamily);
      if (orgFamily) return orgFamily;
      const orgAny = list.find((r) => r.org_id === orgId);
      if (orgAny) return orgAny;
    }
    const orgMatch = list.find((r) => r.org_id === orgId);
    if (orgMatch) return orgMatch;
    const global = list.find((r) => r.org_id == null);
    return global ?? list[0] ?? null;
  };

  return { data: pick(), error: null };
}

export async function getActionPerformanceStatsBatch(
  supabase: SupabaseClient,
  orgId: string,
  actionKeys: string[],
  issueFamily?: string | null
): Promise<Map<string, ActionPerformanceStatRow | null>> {
  const result = new Map<string, ActionPerformanceStatRow | null>();
  for (const key of actionKeys) {
    const { data } = await getActionPerformanceStats(supabase, orgId, key, issueFamily);
    result.set(key, data);
  }
  return result;
}
