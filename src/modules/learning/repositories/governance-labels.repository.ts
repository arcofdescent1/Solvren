import type { SupabaseClient } from "@supabase/supabase-js";

export type GovernanceLabelRow = {
  id: string;
  trace_id: string;
  org_id: string;
  label_type: string;
  label_source: "HUMAN" | "IMPLICIT";
  label_actor_id: string | null;
  confidence: number;
  rationale: string | null;
  created_at: string;
  superseded_by: string | null;
};

export async function insertGovernanceLabel(
  supabase: SupabaseClient,
  input: {
    trace_id: string;
    org_id: string;
    label_type: string;
    label_source: "HUMAN" | "IMPLICIT";
    label_actor_id?: string | null;
    confidence?: number;
    rationale?: string | null;
  }
): Promise<{ data: GovernanceLabelRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("governance_decision_labels")
    .insert({
      trace_id: input.trace_id,
      org_id: input.org_id,
      label_type: input.label_type,
      label_source: input.label_source,
      label_actor_id: input.label_actor_id ?? null,
      confidence: input.confidence ?? 1,
      rationale: input.rationale ?? null,
    })
    .select()
    .single();

  if (error) return { data: null, error: error as Error };
  return { data: data as GovernanceLabelRow, error: null };
}

export async function listActiveLabelsForTrace(
  supabase: SupabaseClient,
  traceId: string
): Promise<{ data: GovernanceLabelRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("governance_decision_labels")
    .select("*")
    .eq("trace_id", traceId)
    .is("superseded_by", null)
    .order("created_at", { ascending: true });

  if (error) return { data: [], error: error as Error };
  return { data: (data ?? []) as GovernanceLabelRow[], error: null };
}

export async function hasExplicitLabelForTrace(
  supabase: SupabaseClient,
  traceId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("governance_decision_labels")
    .select("id")
    .eq("trace_id", traceId)
    .eq("label_source", "HUMAN")
    .is("superseded_by", null)
    .limit(1)
    .maybeSingle();
  return !!data?.id;
}

/** Active non-superseded label of a given type (used to dedupe implicit derivation runs). */
export async function hasActiveLabelOfType(
  supabase: SupabaseClient,
  traceId: string,
  labelType: string
): Promise<boolean> {
  const { data } = await supabase
    .from("governance_decision_labels")
    .select("id")
    .eq("trace_id", traceId)
    .eq("label_type", labelType)
    .is("superseded_by", null)
    .limit(1)
    .maybeSingle();
  return !!data?.id;
}
