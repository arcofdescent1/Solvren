/**
 * Phase 3 — Policy exceptions repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type PolicyExceptionRow = {
  id: string;
  org_id: string;
  policy_id: string;
  scope_json: Record<string, unknown>;
  override_effect_json: Record<string, unknown>;
  reason: string;
  approved_by_user_id: string | null;
  effective_from: string;
  effective_to: string | null;
  status: string;
  created_at: string;
};

export async function listActiveExceptions(
  supabase: SupabaseClient,
  orgId: string,
  context: Record<string, unknown>
): Promise<{ data: PolicyExceptionRow[]; error: Error | null }> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("policy_exceptions")
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "active")
    .lte("effective_from", now)
    .or(`effective_to.is.null,effective_to.gte.${now}`);

  if (error) return { data: [], error: error as Error };
  return { data: (data ?? []) as PolicyExceptionRow[], error: null };
}

export type InsertPolicyExceptionInput = {
  org_id: string;
  policy_id: string;
  scope_json: Record<string, unknown>;
  override_effect_json: Record<string, unknown>;
  reason: string;
  approved_by_user_id?: string | null;
  effective_from: string;
  effective_to?: string | null;
  status?: string;
};

export async function listExceptionsByPolicyId(
  supabase: SupabaseClient,
  policyId: string
): Promise<{ data: PolicyExceptionRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("policy_exceptions")
    .select("*")
    .eq("policy_id", policyId)
    .order("effective_from", { ascending: false });

  if (error) return { data: [], error: error as Error };
  return { data: (data ?? []) as PolicyExceptionRow[], error: null };
}

export async function updatePolicyException(
  supabase: SupabaseClient,
  id: string,
  updates: { status?: string }
): Promise<{ data: PolicyExceptionRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("policy_exceptions")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return { data: null, error: error as Error };
  return { data: data as PolicyExceptionRow, error: null };
}

export async function insertPolicyException(
  supabase: SupabaseClient,
  input: InsertPolicyExceptionInput
): Promise<{ data: PolicyExceptionRow | null; error: Error | null }> {
  const row = {
    org_id: input.org_id,
    policy_id: input.policy_id,
    scope_json: input.scope_json ?? {},
    override_effect_json: input.override_effect_json,
    reason: input.reason,
    approved_by_user_id: input.approved_by_user_id ?? null,
    effective_from: input.effective_from,
    effective_to: input.effective_to ?? null,
    status: input.status ?? "active",
  };
  const { data, error } = await supabase.from("policy_exceptions").insert(row).select().single();
  if (error) return { data: null, error: error as Error };
  return { data: data as PolicyExceptionRow, error: null };
}
