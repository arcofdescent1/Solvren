/**
 * Phase 1 — Terminal classification repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TerminalClassificationType } from "../domain";

export type TerminalClassificationRow = {
  id: string;
  org_id: string;
  issue_id: string;
  classification_type: string;
  outcome_summary: string;
  outcome_payload_json: Record<string, unknown>;
  created_by_type: "system" | "user";
  created_by_user_id: string | null;
  created_at: string;
};

export type InsertTerminalClassificationInput = {
  org_id: string;
  issue_id: string;
  classification_type: TerminalClassificationType;
  outcome_summary: string;
  outcome_payload_json?: Record<string, unknown>;
  created_by_type: "system" | "user";
  created_by_user_id?: string | null;
};

export async function getTerminalClassification(
  supabase: SupabaseClient,
  issueId: string
): Promise<{ data: TerminalClassificationRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("issue_terminal_classifications")
    .select("*")
    .eq("issue_id", issueId)
    .maybeSingle();
  if (error) return { data: null, error: error as unknown as Error };
  return { data: data as TerminalClassificationRow | null, error: null };
}

export async function insertTerminalClassification(
  supabase: SupabaseClient,
  input: InsertTerminalClassificationInput
): Promise<{ data: TerminalClassificationRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("issue_terminal_classifications")
    .insert({
      org_id: input.org_id,
      issue_id: input.issue_id,
      classification_type: input.classification_type,
      outcome_summary: input.outcome_summary,
      outcome_payload_json: input.outcome_payload_json ?? {},
      created_by_type: input.created_by_type,
      created_by_user_id: input.created_by_user_id ?? null,
    })
    .select()
    .single();
  if (error) return { data: null, error: error as unknown as Error };
  return { data: data as TerminalClassificationRow, error: null };
}
