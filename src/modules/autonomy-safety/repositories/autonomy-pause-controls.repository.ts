/**
 * Phase 9 — autonomy_pause_controls repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { AutomationPauseType } from "../domain";

export type AutonomyPauseControlRow = {
  id: string;
  org_id: string;
  pause_type: string;
  scope_type: string;
  scope_ref: string | null;
  reason: string;
  status: string;
  effective_from: string;
  effective_to: string | null;
  created_by_user_id: string | null;
  created_at: string;
};

export type ActivePauseMatch = {
  id: string;
  pauseType: AutomationPauseType;
  reason: string;
  scopeType: string;
  scopeRef: string | null;
};

export async function listActivePauseControls(
  supabase: SupabaseClient,
  orgId: string,
  options?: { scopeType?: string; scopeRef?: string | null }
): Promise<{ data: AutonomyPauseControlRow[]; error: Error | null }> {
  const now = new Date().toISOString();
  let q = supabase
    .from("autonomy_pause_controls")
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "active")
    .lte("effective_from", now)
    .or(`effective_to.is.null,effective_to.gte.${now}`)
    .order("effective_from", { ascending: false });

  if (options?.scopeType) q = q.eq("scope_type", options.scopeType);
  if (options?.scopeRef != null) q = q.eq("scope_ref", options.scopeRef);

  const { data, error } = await q;
  if (error) return { data: [], error: error as Error };
  return { data: (data ?? []) as AutonomyPauseControlRow[], error: null };
}

export async function findMatchingPauses(
  supabase: SupabaseClient,
  orgId: string,
  context: {
    scopeType?: string;
    scopeRef?: string | null;
    actionKey?: string | null;
    playbookKey?: string | null;
    provider?: string | null;
  }
): Promise<{ data: ActivePauseMatch[]; error: Error | null }> {
  const { data: pauses, error } = await listActivePauseControls(supabase, orgId);
  if (error) return { data: [], error };

  const matches: ActivePauseMatch[] = [];
  for (const p of pauses) {
    const row = p as AutonomyPauseControlRow;
    const scopeRef = row.scope_ref;
    const scopeType = row.scope_type;

    let matchesScope = false;
    if (scopeType === "org" && !scopeRef) matchesScope = true; // global pause
    if (scopeType === "integration" && scopeRef && context.provider === scopeRef) matchesScope = true;
    if (scopeType === "action" && scopeRef && context.actionKey === scopeRef) matchesScope = true;
    if (scopeType === "playbook" && scopeRef && context.playbookKey === scopeRef) matchesScope = true;
    if (scopeType === "issue_family" && scopeRef) matchesScope = true;
    if (scopeType === "environment" && scopeRef) matchesScope = true;
    if (scopeType === context.scopeType && (scopeRef == null || scopeRef === context.scopeRef)) matchesScope = true;

    if (matchesScope) {
      matches.push({
        id: row.id,
        pauseType: row.pause_type as AutomationPauseType,
        reason: row.reason,
        scopeType,
        scopeRef,
      });
    }
  }
  return { data: matches, error: null };
}

export async function createPauseControl(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    pauseType: string;
    scopeType: string;
    scopeRef?: string | null;
    reason: string;
    createdByUserId?: string | null;
  }
): Promise<{ data: AutonomyPauseControlRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("autonomy_pause_controls")
    .insert({
      org_id: input.orgId,
      pause_type: input.pauseType,
      scope_type: input.scopeType,
      scope_ref: input.scopeRef ?? null,
      reason: input.reason,
      status: "active",
      effective_from: new Date().toISOString(),
      created_by_user_id: input.createdByUserId ?? null,
    })
    .select()
    .single();

  if (error) return { data: null, error: error as Error };
  return { data: data as AutonomyPauseControlRow, error: null };
}

export async function clearPauseControl(
  supabase: SupabaseClient,
  pauseId: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("autonomy_pause_controls")
    .update({ status: "cleared", effective_to: new Date().toISOString() })
    .eq("id", pauseId);

  return { error: error ? (error as Error) : null };
}
