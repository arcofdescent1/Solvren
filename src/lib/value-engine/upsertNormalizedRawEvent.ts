/**
 * Phase 1 — raw_events upsert: (org_id, provider, external_id, event_type) uniqueness.
 * Detection uses occurred_at; ingestion bookkeeping uses ingested_at.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { computePayloadHash } from "@/modules/signals/ingestion/idempotency.service";
import { computeEventFingerprint } from "./fingerprint";

export type UpsertNormalizedRawEventInput = {
  orgId: string;
  provider: string;
  /** Stripe | HubSpot | Salesforce — alias for provider when storing */
  sourceChannel?: string;
  externalId: string;
  eventType: string;
  occurredAt: string;
  payload: Record<string, unknown>;
  integrationAccountId?: string | null;
};

export async function upsertNormalizedRawEvent(
  supabase: SupabaseClient,
  input: UpsertNormalizedRawEventInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const extId = input.externalId.trim();
  if (!extId) return { ok: false, error: "externalId required" };

  const ingestedAt = new Date().toISOString();
  const fingerprint = computeEventFingerprint(input.orgId, input.provider, extId, input.eventType);
  const payloadHash = computePayloadHash(input.payload);
  const idempotencyKey = `ve:${input.provider}:${extId}:${input.eventType}`;

  const row = {
    org_id: input.orgId,
    integration_account_id: input.integrationAccountId ?? null,
    provider: input.provider,
    source_channel: input.sourceChannel ?? "incremental_sync",
    external_event_id: extId,
    external_object_type: null as string | null,
    external_object_id: extId,
    event_type: input.eventType,
    event_time: input.occurredAt,
    occurred_at: input.occurredAt,
    ingested_at: ingestedAt,
    received_at: ingestedAt,
    payload_json: input.payload,
    headers_json: null as Record<string, unknown> | null,
    payload_hash: payloadHash,
    idempotency_key: idempotencyKey,
    fingerprint,
    external_id: extId,
    processing_status: "processed" as const,
    processing_attempts: 0,
    last_error_code: null as string | null,
    last_error_message: null as string | null,
    mapper_key: "value_engine_v1" as string | null,
    mapper_version: "1" as string | null,
  };

  const { data, error } = await supabase
    .from("raw_events")
    .upsert(
      { ...row, updated_at: ingestedAt },
      { onConflict: "org_id,provider,external_id,event_type" }
    )
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  if (!data?.id) return { ok: false, error: "upsert returned no id" };
  return { ok: true, id: data.id as string };
}
