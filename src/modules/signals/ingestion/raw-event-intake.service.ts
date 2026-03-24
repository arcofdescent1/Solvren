/**
 * Phase 3 — Raw event intake (§10).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SourceChannel } from "../domain/types";
import { insertRawEvent } from "../persistence/raw-events.repository";
import { getRawEventByIdempotency } from "../persistence/raw-events.repository";
import { deriveIdempotencyKey, computePayloadHash } from "./idempotency.service";

export type IntakeRawEventInput = {
  orgId: string;
  integrationAccountId?: string | null;
  provider: string;
  sourceChannel: SourceChannel | string;
  externalEventId?: string | null;
  externalObjectType?: string | null;
  externalObjectId?: string | null;
  eventType: string;
  eventTime?: string | null;
  payload: Record<string, unknown>;
  headers?: Record<string, unknown> | null;
  canonicalOutputJson?: Record<string, unknown> | null;
};

export type IntakeRawEventResult =
  | { ok: true; rawEventId: string; created: boolean }
  | { ok: false; error: string };

export async function intakeRawEvent(
  supabase: SupabaseClient,
  input: IntakeRawEventInput
): Promise<IntakeRawEventResult> {
  const payloadHash = computePayloadHash(input.payload);
  const idempotencyKey = deriveIdempotencyKey({
    provider: input.provider,
    externalEventId: input.externalEventId,
    externalObjectType: input.externalObjectType,
    externalObjectId: input.externalObjectId,
    eventType: input.eventType,
    eventTime: input.eventTime,
    payloadHash,
  });

  const { data: existing } = await getRawEventByIdempotency(
    supabase,
    input.orgId,
    input.provider,
    idempotencyKey
  );
  if (existing) {
    return { ok: true, rawEventId: existing.id, created: false };
  }

  const { data: inserted, error } = await insertRawEvent(supabase, {
    org_id: input.orgId,
    integration_account_id: input.integrationAccountId ?? null,
    provider: input.provider,
    source_channel: input.sourceChannel,
    external_event_id: input.externalEventId ?? null,
    external_object_type: input.externalObjectType ?? null,
    external_object_id: input.externalObjectId ?? null,
    event_type: input.eventType,
    event_time: input.eventTime ?? null,
    received_at: new Date().toISOString(),
    payload_json: input.payload,
    headers_json: input.headers ?? null,
    payload_hash: payloadHash,
    idempotency_key: idempotencyKey,
    processing_status: "pending",
    processing_attempts: 0,
    last_error_code: null,
    last_error_message: null,
    mapper_key: null,
    mapper_version: null,
    canonical_output_json: input.canonicalOutputJson ?? null,
  });

  if (error) return { ok: false, error: error.message };
  if (!inserted) return { ok: false, error: "Insert failed" };
  return { ok: true, rawEventId: inserted.id, created: true };
}
