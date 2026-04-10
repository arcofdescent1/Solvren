/**
 * Phase 4 — Dead-letter service (§16).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { insertDeadLetter, updateDeadLetterStatus } from "../repositories/integration-dead-letters.repository";

export type CreateDeadLetterInput = {
  orgId: string;
  provider: string;
  deadLetterType: "INBOUND_EVENT" | "OUTBOUND_ACTION" | "RECONCILIATION";
  sourceRecordId: string;
  reasonCode: string;
  reasonMessage: string;
  payload?: Record<string, unknown>;
  retryable?: boolean;
};

export async function createDeadLetter(
  supabase: SupabaseClient,
  input: CreateDeadLetterInput
): Promise<{ id: string | null; error: Error | null }> {
  const { data, error } = await insertDeadLetter(supabase, {
    org_id: input.orgId,
    provider: input.provider,
    dead_letter_type: input.deadLetterType,
    source_record_id: input.sourceRecordId,
    reason_code: input.reasonCode,
    reason_message: input.reasonMessage,
    payload_json: input.payload ?? {},
    retryable: input.retryable ?? true,
  });
  if (error) return { id: null, error };
  return { id: data?.id ?? null, error: null };
}

export async function markDeadLetterRetried(
  supabase: SupabaseClient,
  id: string
): Promise<{ error: Error | null }> {
  return updateDeadLetterStatus(supabase, id, "RETRIED");
}

export async function markDeadLetterIgnored(
  supabase: SupabaseClient,
  id: string,
  _reason: string
): Promise<{ error: Error | null }> {
  return updateDeadLetterStatus(supabase, id, "IGNORED");
}
