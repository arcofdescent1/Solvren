/**
 * Phase 4 — Integration dead letters.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type IntegrationDeadLetterRow = {
  id: string;
  org_id: string;
  provider: string;
  dead_letter_type: "INBOUND_EVENT" | "OUTBOUND_ACTION" | "RECONCILIATION";
  source_record_id: string;
  reason_code: string;
  reason_message: string;
  payload_json: Record<string, unknown>;
  retryable: boolean;
  status: string;
  created_at: string;
  resolved_at: string | null;
};

export async function insertDeadLetter(
  supabase: SupabaseClient,
  input: {
    org_id: string;
    provider: string;
    dead_letter_type: "INBOUND_EVENT" | "OUTBOUND_ACTION" | "RECONCILIATION";
    source_record_id: string;
    reason_code: string;
    reason_message: string;
    payload_json?: Record<string, unknown>;
    retryable?: boolean;
  }
): Promise<{ data: IntegrationDeadLetterRow | null; error: Error | null }> {
  const row = {
    org_id: input.org_id,
    provider: input.provider,
    dead_letter_type: input.dead_letter_type,
    source_record_id: input.source_record_id,
    reason_code: input.reason_code,
    reason_message: input.reason_message,
    payload_json: input.payload_json ?? {},
    retryable: input.retryable ?? true,
  };
  const { data, error } = await supabase
    .from("integration_dead_letters")
    .insert(row)
    .select()
    .single();
  if (error) return { data: null, error: error as Error };
  return { data: data as IntegrationDeadLetterRow, error: null };
}

export async function listDeadLetters(
  supabase: SupabaseClient,
  orgId: string,
  filters?: { provider?: string; status?: string; type?: string },
  limit = 50
): Promise<{ data: IntegrationDeadLetterRow[]; error: Error | null }> {
  let q = supabase
    .from("integration_dead_letters")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (filters?.provider) q = q.eq("provider", filters.provider);
  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.type) q = q.eq("dead_letter_type", filters.type);
  const { data, error } = await q;
  return { data: (data ?? []) as IntegrationDeadLetterRow[], error: error as Error | null };
}

export async function getDeadLetter(
  supabase: SupabaseClient,
  id: string
): Promise<{ data: IntegrationDeadLetterRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("integration_dead_letters")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return { data: data as IntegrationDeadLetterRow | null, error: error as Error | null };
}

export async function updateDeadLetterStatus(
  supabase: SupabaseClient,
  id: string,
  status: "RETRIED" | "RESOLVED" | "IGNORED"
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("integration_dead_letters")
    .update({ status, resolved_at: new Date().toISOString() })
    .eq("id", id);
  return { error: error as Error | null };
}
