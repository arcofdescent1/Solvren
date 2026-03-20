/**
 * Phase 9 — autonomy_mode_configs repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ExecutionMode } from "../domain";

export type AutonomyModeConfigRow = {
  id: string;
  org_id: string;
  scope_type: string;
  scope_ref: string | null;
  requested_mode: string;
  status: string;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export async function listAutonomyModeConfigs(
  supabase: SupabaseClient,
  orgId: string,
  options?: { scopeType?: string; status?: string }
): Promise<{ data: AutonomyModeConfigRow[]; error: Error | null }> {
  let q = supabase
    .from("autonomy_mode_configs")
    .select("*")
    .eq("org_id", orgId)
    .order("scope_type")
    .order("scope_ref");

  if (options?.scopeType) q = q.eq("scope_type", options.scopeType);
  if (options?.status) q = q.eq("status", options.status);

  const { data, error } = await q;
  if (error) return { data: [], error: error as Error };
  return { data: (data ?? []) as AutonomyModeConfigRow[], error: null };
}

export async function getEffectiveRequestedMode(
  supabase: SupabaseClient,
  orgId: string,
  scope: { scopeType: string; scopeRef?: string | null }
): Promise<{ mode: ExecutionMode | null; error: Error | null }> {
  const scopesToTry: { scopeType: string; scopeRef: string | null }[] = [];
  if (scope.scopeRef != null) {
    scopesToTry.push({ scopeType: scope.scopeType, scopeRef: scope.scopeRef });
  }
  scopesToTry.push({ scopeType: "org", scopeRef: null });

  for (const s of scopesToTry) {
    let q = supabase
      .from("autonomy_mode_configs")
      .select("requested_mode")
      .eq("org_id", orgId)
      .eq("scope_type", s.scopeType)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);

    if (s.scopeRef != null) {
      q = q.eq("scope_ref", s.scopeRef);
    } else {
      q = q.is("scope_ref", null);
    }

    const { data, error } = await q.maybeSingle();
    if (error) return { mode: null, error: error as Error };
    if (data?.requested_mode) {
      return { mode: data.requested_mode as ExecutionMode, error: null };
    }
  }
  return { mode: null, error: null };
}

export async function upsertAutonomyModeConfig(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    scopeType: string;
    scopeRef?: string | null;
    requestedMode: ExecutionMode;
    createdByUserId?: string | null;
  }
): Promise<{ data: AutonomyModeConfigRow | null; error: Error | null }> {
  const { data: existing } = await supabase
    .from("autonomy_mode_configs")
    .select("id")
    .eq("org_id", input.orgId)
    .eq("scope_type", input.scopeType)
    .eq("scope_ref", input.scopeRef ?? null)
    .eq("status", "active")
    .maybeSingle();

  const row = {
    org_id: input.orgId,
    scope_type: input.scopeType,
    scope_ref: input.scopeRef ?? null,
    requested_mode: input.requestedMode,
    status: "active",
    created_by_user_id: input.createdByUserId ?? null,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await supabase
      .from("autonomy_mode_configs")
      .update(row)
      .eq("id", (existing as { id: string }).id)
      .select()
      .single();
    if (error) return { data: null, error: error as Error };
    return { data: data as AutonomyModeConfigRow, error: null };
  }

  const { data, error } = await supabase
    .from("autonomy_mode_configs")
    .insert({ ...row, created_at: new Date().toISOString() })
    .select()
    .single();
  if (error) return { data: null, error: error as Error };
  return { data: data as AutonomyModeConfigRow, error: null };
}
