/**
 * Phase 3 — Policies repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PolicyDefinition } from "../domain";

export type PolicyRow = {
  id: string;
  org_id: string | null;
  policy_key: string;
  display_name: string;
  description: string;
  scope: string;
  scope_ref: string | null;
  priority_order: number;
  status: string;
  default_disposition: string;
  rules_json: unknown[];
  effective_from: string;
  effective_to: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

function rowToDefinition(row: PolicyRow): PolicyDefinition {
  return {
    policyKey: row.policy_key,
    displayName: row.display_name,
    description: row.description,
    scope: row.scope as PolicyDefinition["scope"],
    scopeRef: row.scope_ref ?? undefined,
    priorityOrder: row.priority_order,
    status: row.status as PolicyDefinition["status"],
    rules: (row.rules_json ?? []) as PolicyDefinition["rules"],
    defaultDisposition: row.default_disposition as PolicyDefinition["defaultDisposition"],
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to ?? undefined,
  };
}

export async function listPoliciesForEvaluation(
  supabase: SupabaseClient,
  orgId: string,
  environment: string
): Promise<{ data: PolicyDefinition[]; error: Error | null }> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("policies")
    .select("id, org_id, policy_key, display_name, description, scope, scope_ref, priority_order, status, default_disposition, rules_json, effective_from, effective_to")
    .in("status", ["active"])
    .lte("effective_from", now)
    .or(`effective_to.is.null,effective_to.gte.${now}`)
    .or(`org_id.is.null,org_id.eq.${orgId}`)
    .order("priority_order", { ascending: true });

  if (error) return { data: [], error: error as Error };
  const rows = (data ?? []) as PolicyRow[];
  const definitions = rows.map(rowToDefinition);
  return { data: definitions, error: null };
}

export async function listPolicies(
  supabase: SupabaseClient,
  orgId: string | null,
  options?: { status?: string; scope?: string }
): Promise<{ data: PolicyRow[]; error: Error | null }> {
  let q = supabase
    .from("policies")
    .select("*")
    .order("priority_order", { ascending: true });

  if (orgId !== null) {
    q = q.or(`org_id.is.null,org_id.eq.${orgId}`);
  } else {
    q = q.is("org_id", null);
  }
  if (options?.status) q = q.eq("status", options.status);
  if (options?.scope) q = q.eq("scope", options.scope);

  const { data, error } = await q;
  return { data: (data ?? []) as PolicyRow[], error: error as Error | null };
}

export async function getPolicyById(
  supabase: SupabaseClient,
  id: string
): Promise<{ data: PolicyRow | null; error: Error | null }> {
  const { data, error } = await supabase.from("policies").select("*").eq("id", id).maybeSingle();
  return { data: data as PolicyRow | null, error: error as Error | null };
}

export async function getPolicyByKey(
  supabase: SupabaseClient,
  orgId: string | null,
  policyKey: string
): Promise<{ data: PolicyRow | null; error: Error | null }> {
  let q = supabase.from("policies").select("*").eq("policy_key", policyKey);
  if (orgId !== null) q = q.or(`org_id.is.null,org_id.eq.${orgId}`);
  else q = q.is("org_id", null);
  const { data, error } = await q.maybeSingle();
  return { data: data as PolicyRow | null, error: error as Error | null };
}

export type InsertPolicyInput = {
  org_id?: string | null;
  policy_key: string;
  display_name: string;
  description: string;
  scope: string;
  scope_ref?: string | null;
  priority_order?: number;
  status?: string;
  default_disposition: string;
  rules_json: unknown[];
  effective_from?: string;
  effective_to?: string | null;
  created_by_user_id?: string | null;
};

export async function insertPolicy(
  supabase: SupabaseClient,
  input: InsertPolicyInput
): Promise<{ data: PolicyRow | null; error: Error | null }> {
  const row = {
    org_id: input.org_id ?? null,
    policy_key: input.policy_key,
    display_name: input.display_name,
    description: input.description,
    scope: input.scope,
    scope_ref: input.scope_ref ?? null,
    priority_order: input.priority_order ?? 100,
    status: input.status ?? "active",
    default_disposition: input.default_disposition,
    rules_json: input.rules_json,
    effective_from: input.effective_from ?? new Date().toISOString(),
    effective_to: input.effective_to ?? null,
    created_by_user_id: input.created_by_user_id ?? null,
  };
  const { data, error } = await supabase.from("policies").insert(row).select().single();
  if (error) return { data: null, error: error as Error };
  return { data: data as PolicyRow, error: null };
}

export async function updatePolicy(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<InsertPolicyInput>
): Promise<{ data: PolicyRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("policies")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) return { data: null, error: error as Error };
  return { data: data as PolicyRow, error: null };
}
