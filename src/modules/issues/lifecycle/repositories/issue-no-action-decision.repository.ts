/**
 * Phase 1 — No-action decision repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NoActionReason } from "../domain";

export type NoActionDecisionRow = {
  id: string;
  org_id: string;
  issue_id: string;
  no_action_reason: string;
  no_action_notes: string | null;
  requires_approval: boolean;
  approved_by_user_id: string | null;
  created_by_user_id: string | null;
  created_at: string;
};

export type InsertNoActionDecisionInput = {
  org_id: string;
  issue_id: string;
  no_action_reason: NoActionReason;
  no_action_notes?: string | null;
  requires_approval?: boolean;
  approved_by_user_id?: string | null;
  created_by_user_id?: string | null;
};

export async function getNoActionDecision(
  supabase: SupabaseClient,
  issueId: string
): Promise<{ data: NoActionDecisionRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("issue_no_action_decisions")
    .select("*")
    .eq("issue_id", issueId)
    .maybeSingle();
  if (error) return { data: null, error: error as unknown as Error };
  return { data: data as NoActionDecisionRow | null, error: null };
}

export async function insertNoActionDecision(
  supabase: SupabaseClient,
  input: InsertNoActionDecisionInput
): Promise<{ data: NoActionDecisionRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("issue_no_action_decisions")
    .insert({
      org_id: input.org_id,
      issue_id: input.issue_id,
      no_action_reason: input.no_action_reason,
      no_action_notes: input.no_action_notes ?? null,
      requires_approval: input.requires_approval ?? false,
      approved_by_user_id: input.approved_by_user_id ?? null,
      created_by_user_id: input.created_by_user_id ?? null,
    })
    .select()
    .single();
  if (error) return { data: null, error: error as unknown as Error };
  return { data: data as NoActionDecisionRow, error: null };
}
