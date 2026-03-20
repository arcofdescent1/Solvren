/**
 * Phase 4 — detector_suppression_state repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function getSuppressionState(
  supabase: SupabaseClient,
  orgId: string,
  detectorDefinitionId: string,
  suppressionScopeKey: string
): Promise<{ activeUntil: string | null; state: Record<string, unknown> } | null> {
  const { data } = await supabase
    .from("detector_suppression_state")
    .select("active_until, state_json")
    .eq("org_id", orgId)
    .eq("detector_definition_id", detectorDefinitionId)
    .eq("suppression_scope_key", suppressionScopeKey)
    .maybeSingle();
  if (!data) return null;
  return {
    activeUntil: (data as { active_until: string | null }).active_until,
    state: ((data as { state_json: Record<string, unknown> }).state_json ?? {}) as Record<string, unknown>,
  };
}

export async function upsertSuppressionState(
  supabase: SupabaseClient,
  input: {
    org_id: string;
    detector_definition_id: string;
    suppression_scope_key: string;
    active_until: string | null;
    state_json: Record<string, unknown>;
  }
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("detector_suppression_state")
    .upsert(
      { ...input, updated_at: new Date().toISOString() },
      { onConflict: "org_id,detector_definition_id,suppression_scope_key" }
    );
  return { error: error as Error | null };
}
