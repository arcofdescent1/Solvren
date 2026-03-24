/**
 * Phase 4 — Inbound ingest service (§10.1).
 * Persist first, process second.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  insertInboundEvent,
  findInboundEventByIdempotencyKey,
} from "../repositories/integration-inbound-events.repository";
import { deriveInboundIdempotencyKey, hashPayloadContent } from "./idempotency.service";

export type InboundWebhookInput = {
  orgId: string;
  integrationAccountId: string;
  provider: string;
  sourceChannel: "webhook" | "sync" | "backfill" | "warehouse" | "internal" | "reconcile" | "salesforce_cdc";
  externalEventId?: string | null;
  externalObjectType?: string | null;
  externalObjectId?: string | null;
  eventType: string;
  eventTime?: string | null;
  payload: Record<string, unknown>;
  headers?: Record<string, unknown> | null;
  /** When already validated before persist (e.g. signature + resolution done). */
  initialStatus?: "RECEIVED" | "VALIDATED";
};

export type InboundIngestResult =
  | { persisted: true; eventId: string; duplicate: false }
  | { persisted: true; eventId: string; duplicate: true }
  | { persisted: false; error: string };

export async function ingestInboundEvent(
  supabase: SupabaseClient,
  input: InboundWebhookInput
): Promise<InboundIngestResult> {
  const payloadHash = hashPayloadContent(input.payload);
  const idempotencyKey = deriveInboundIdempotencyKey({
    provider: input.provider,
    external_event_id: input.externalEventId,
    external_object_type: input.externalObjectType,
    external_object_id: input.externalObjectId,
    event_type: input.eventType,
    event_time: input.eventTime,
    payload_hash: payloadHash,
    source_channel: input.sourceChannel,
  });

  const { data: existing } = await findInboundEventByIdempotencyKey(
    supabase,
    input.orgId,
    input.provider,
    idempotencyKey
  );
  if (existing) {
    return { persisted: true, eventId: existing.id, duplicate: true };
  }

  const { data, error } = await insertInboundEvent(supabase, {
    org_id: input.orgId,
    integration_account_id: input.integrationAccountId,
    provider: input.provider,
    source_channel: input.sourceChannel,
    external_event_id: input.externalEventId,
    external_object_type: input.externalObjectType,
    external_object_id: input.externalObjectId,
    event_type: input.eventType,
    event_time: input.eventTime,
    payload_json: input.payload,
    headers_json: input.headers ?? null,
    payload_hash: payloadHash,
    idempotency_key: idempotencyKey,
    initial_status: input.initialStatus ?? "RECEIVED",
  });

  if (error) return { persisted: false, error: error.message };
  if (!data) return { persisted: false, error: "Insert returned no data" };
  return { persisted: true, eventId: data.id, duplicate: false };
}
