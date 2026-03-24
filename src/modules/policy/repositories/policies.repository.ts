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
  version?: number;
  is_system_policy?: boolean;
  archived_at?: string | null;
  updated_by_user_id?: string | null;
  policy_owner_type?: string | null;
  relaxation_mode?: string | null;
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
  _environment: string
): Promise<{ data: PolicyDefinition[]; error: Error | null }> {
  const { data: rows, error } = await listPolicyRowsForEvaluation(supabase, orgId);
  if (error) return { data: [], error };
  return { data: rows.map((r) => rowToDefinition(r)), error: null };
}

/** Active policies for evaluation with row metadata (Phase 5 governance / ownership). */
export async function listPolicyRowsForEvaluation(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ data: PolicyRow[]; error: Error | null }> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("policies")
    .select(
      "id, org_id, policy_key, display_name, description, scope, scope_ref, priority_order, status, default_disposition, rules_json, effective_from, effective_to, policy_owner_type, relaxation_mode"
    )
    .in("status", ["active"])
    .lte("effective_from", now)
    .or(`effective_to.is.null,effective_to.gte.${now}`)
    .or(`org_id.is.null,org_id.eq.${orgId}`)
    .order("priority_order", { ascending: true });

  if (error) return { data: [], error: error as Error };
  return { data: (data ?? []) as PolicyRow[], error: null };
}

export async function listPolicies(
  supabase: SupabaseClient,
  orgId: string | null,
  options?: { status?: string; scope?: string; includeArchived?: boolean; search?: string; page?: number; pageSize?: number }
): Promise<{ data: PolicyRow[]; total?: number; error: Error | null }> {
  const usePagination = options?.page != null && options.page >= 1;
  let q = supabase
    .from("policies")
    .select("*", usePagination ? { count: "exact" } : undefined)
    .order("priority_order", { ascending: true });

  if (orgId !== null) {
    q = q.or(`org_id.is.null,org_id.eq.${orgId}`);
  } else {
    q = q.is("org_id", null);
  }
  if (options?.status) q = q.eq("status", options.status);
  if (options?.scope) q = q.eq("scope", options.scope);
  if (!options?.includeArchived) q = q.is("archived_at", null);
  if (options?.search?.trim()) {
    q = q.or(`display_name.ilike.%${options.search.trim()}%,policy_key.ilike.%${options.search.trim()}%`);
  }

  const page = options?.page ?? 1;
  const pageSize = Math.min(options?.pageSize ?? 25, 100);
  if (usePagination) {
    q = q.range((page - 1) * pageSize, page * pageSize - 1);
  }

  const { data, error, count } = await q;
  return {
    data: (data ?? []) as PolicyRow[],
    total: count ?? undefined,
    error: error as Error | null,
  };
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
  updates: Partial<InsertPolicyInput & { updated_by_user_id?: string | null; archived_at?: string | null }>
): Promise<{ data: PolicyRow | null; error: Error | null }> {
  const { data: existing } = await getPolicyById(supabase, id);
  if (!existing) return { data: null, error: new Error("Policy not found") };

  const nextVersion = (existing.version ?? 1) + 1;
  const snapshot = {
    policy_key: existing.policy_key,
    display_name: existing.display_name,
    description: existing.description,
    scope: existing.scope,
    scope_ref: existing.scope_ref,
    priority_order: existing.priority_order,
    status: existing.status,
    default_disposition: existing.default_disposition,
    rules_json: existing.rules_json,
    effective_from: existing.effective_from,
    effective_to: existing.effective_to,
  };

  const { error: verError } = await supabase.from("policy_versions").insert({
    policy_id: id,
    version: existing.version ?? 1,
    snapshot_json: snapshot,
    created_by_user_id: updates.updated_by_user_id ?? null,
  });
  if (verError) return { data: null, error: verError as Error };

  const updateRow: Record<string, unknown> = {
    ...updates,
    version: nextVersion,
    updated_at: new Date().toISOString(),
    updated_by_user_id: updates.updated_by_user_id ?? null,
  };
  if ("archived_at" in updates) updateRow.archived_at = updates.archived_at;

  const { data, error } = await supabase
    .from("policies")
    .update(updateRow)
    .eq("id", id)
    .select()
    .single();
  if (error) return { data: null, error: error as Error };
  return { data: data as PolicyRow, error: null };
}

export async function duplicatePolicy(
  supabase: SupabaseClient,
  id: string,
  options: { org_id?: string | null; policy_key: string; display_name: string; created_by_user_id?: string | null }
): Promise<{ data: PolicyRow | null; error: Error | null }> {
  const { data: existing } = await getPolicyById(supabase, id);
  if (!existing) return { data: null, error: new Error("Policy not found") };

  return insertPolicy(supabase, {
    org_id: options.org_id ?? existing.org_id,
    policy_key: options.policy_key,
    display_name: options.display_name,
    description: existing.description,
    scope: existing.scope,
    scope_ref: existing.scope_ref,
    priority_order: existing.priority_order,
    status: "draft",
    default_disposition: existing.default_disposition,
    rules_json: existing.rules_json,
    effective_from: existing.effective_from,
    effective_to: existing.effective_to,
    created_by_user_id: options.created_by_user_id ?? null,
  });
}

export async function archivePolicy(
  supabase: SupabaseClient,
  id: string
): Promise<{ data: PolicyRow | null; error: Error | null }> {
  const { data: existing } = await getPolicyById(supabase, id);
  if (!existing) return { data: null, error: new Error("Policy not found") };
  if ((existing as PolicyRow).is_system_policy) {
    return { data: null, error: new Error("System policies cannot be archived") };
  }
  if (
    String(existing.policy_owner_type ?? "").toUpperCase() === "PLATFORM" &&
    String(existing.relaxation_mode ?? "").toUpperCase() === "NON_RELAXABLE"
  ) {
    return { data: null, error: new Error("Non-relaxable platform policies cannot be archived") };
  }

  return updatePolicy(supabase, id, {
    status: "inactive",
    archived_at: new Date().toISOString(),
    updated_by_user_id: null,
  });
}
