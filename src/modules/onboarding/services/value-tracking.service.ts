/**
 * Gap 5 — Value tracking engine (§10).
 * Records value events for onboarding and value dashboard.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type ValueType = "recovered" | "avoided";

export type RecordValueEventInput = {
  orgId: string;
  issueId?: string | null;
  actionExecutionId?: string | null;
  valueType: ValueType;
  amount: number;
  confidence?: number;
};

export async function recordValueEvent(
  supabase: SupabaseClient,
  input: RecordValueEventInput
): Promise<{ id: string | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("value_events")
    .insert({
      org_id: input.orgId,
      issue_id: input.issueId ?? null,
      action_execution_id: input.actionExecutionId ?? null,
      value_type: input.valueType,
      amount: input.amount,
      confidence: input.confidence ?? 1,
    })
    .select("id")
    .single();
  if (error) return { id: null, error: error as Error };
  return { id: (data as { id: string })?.id ?? null, error: null };
}
