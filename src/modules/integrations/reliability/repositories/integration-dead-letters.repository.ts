/**
 * Phase 4 — Integration dead letters.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { insertDeadLetterSecure } from "@/modules/ingestion/ingestion.repository";

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
  sanitized_payload?: Record<string, unknown> | null;
  payload_audit?: { redacted_count: number; hashed_count: number; dropped_count: number } | null;
  is_legacy?: boolean;
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
  return insertDeadLetterSecure(supabase, input) as Promise<{
    data: IntegrationDeadLetterRow | null;
    error: Error | null;
  }>;
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
