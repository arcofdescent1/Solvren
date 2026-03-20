/**
 * Phase 8 — policies persistence.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type PolicyRow = {
  id: string;
  org_id: string;
  policy_key: string;
  display_name: string;
  description: string;
  policy_scope: string;
  scope_ref_json: Record<string, unknown>;
  status: string;
  autonomy_mode: string;
  policy_rules_json: Record<string, unknown>;
  priority_order: number;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
  updated_at: string;
};

export async function listActivePolicies(
  supabase: SupabaseClient,
  orgId: string,
  scope?: string
): Promise<{ data: PolicyRow[]; error: Error | null }> {
  const now = new Date().toISOString();
  let q = supabase
    .from("policies")
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "active")
    .lte("effective_from", now)
    .or(`effective_to.is.null,effective_to.gte.${now}`)
    .order("priority_order", { ascending: true });
  if (scope) q = q.eq("policy_scope", scope);
  const { data, error } = await q;
  return { data: (data ?? []) as PolicyRow[], error: error as Error | null };
}

export async function getOrgAutonomySettings(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ data: { automation_paused: boolean } | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("org_autonomy_settings")
    .select("automation_paused")
    .eq("org_id", orgId)
    .maybeSingle();
  return { data: data as { automation_paused: boolean } | null, error: error as Error | null };
}

export async function setAutomationPaused(
  supabase: SupabaseClient,
  orgId: string,
  paused: boolean,
  userId?: string | null,
  reason?: string | null
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("org_autonomy_settings")
    .upsert(
      {
        org_id: orgId,
        automation_paused: paused,
        paused_at: paused ? new Date().toISOString() : null,
        paused_by_user_id: paused ? userId : null,
        pause_reason: reason ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id" }
    );
  return { error: error as Error | null };
}
