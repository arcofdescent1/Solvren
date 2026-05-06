/**
 * Phase 2 — Single write boundary for ingestion persistence (redaction + dual-write).
 * Only this module may call `.insert` / `.upsert` on ingestion tables from the ingestion pipeline.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getFieldSchema } from "@/lib/security/field-schema-registry";
import { safeLog } from "@/lib/security/safe-logger";
import { secureIngest } from "@/lib/security/secure-ingest";
import type { InsertInboundEventInput } from "@/modules/integrations/reliability/types/inbound-event";
import type { RawEventRow } from "@/modules/signals/domain/types";
import type { WebhookProcessedStatus } from "@/modules/integrations/contracts/types";
import type { UpsertNormalizedRawEventInput } from "@/lib/value-engine/upsert-types";
import { computeEventFingerprint } from "@/lib/value-engine/fingerprint";
import { computePayloadHash } from "@/modules/signals/ingestion/idempotency.service";
import { getIngestionNormalizer } from "./adapters";
import { assertOperationalIngestPersistAllowed } from "@/lib/server/privacy/operational-persist";

/** Webhook envelope insert (matches integration_webhook_events minus id/received_at). */
export type WebhookEventInsert = {
  integration_account_id: string | null;
  provider: string;
  external_event_id: string | null;
  event_type: string;
  request_headers_json: Record<string, unknown>;
  payload_json: Record<string, unknown>;
  signature_valid: boolean | null;
  processed_status: WebhookProcessedStatus;
  processed_at: string | null;
  processing_error_json: unknown;
  dedupe_key: string | null;
};

function shadowMode(): boolean {
  return process.env.INGESTION_SHADOW_MODE === "1";
}

export async function resolveOrgIdForIntegrationAccount(
  supabase: SupabaseClient,
  integrationAccountId: string | null
): Promise<string> {
  if (!integrationAccountId) return "__no_org__";
  const { data } = await supabase
    .from("integration_accounts")
    .select("org_id")
    .eq("id", integrationAccountId)
    .maybeSingle();
  const row = data as { org_id?: string } | null;
  return row?.org_id ?? "__no_org__";
}

export async function insertInboundEventSecure(
  supabase: SupabaseClient,
  input: InsertInboundEventInput
): Promise<{ data: Record<string, unknown> | null; error: Error | null }> {
  await assertOperationalIngestPersistAllowed(supabase, input.org_id);
  const schema = getFieldSchema(input.provider);
  const normalize = getIngestionNormalizer(input.provider);
  const result = secureIngest({
    source: `integration_inbound_events:${input.provider}`,
    payload: input.payload_json,
    schema,
    orgId: input.org_id,
    normalize,
  });

  if (shadowMode()) {
    safeLog("ingestion_shadow_inbound", {
      org_id: input.org_id,
      provider: input.provider,
      redacted_count: result.audit.redacted_count,
      hashed_count: result.audit.hashed_count,
      dropped_count: result.audit.dropped_count,
    });
  }

  const status = input.initial_status ?? "RECEIVED";
  const row = {
    org_id: input.org_id,
    integration_account_id: input.integration_account_id,
    provider: input.provider,
    source_channel: input.source_channel,
    external_event_id: input.external_event_id ?? null,
    external_object_type: input.external_object_type ?? null,
    external_object_id: input.external_object_id ?? null,
    event_type: input.event_type,
    event_time: input.event_time ?? null,
    payload_json: input.payload_json,
    headers_json: input.headers_json ?? null,
    payload_hash: input.payload_hash,
    idempotency_key: input.idempotency_key,
    ingest_status: status,
    sanitized_payload: shadowMode() ? null : result.normalized,
    payload_audit: shadowMode() ? null : result.audit,
    is_legacy: false,
  };

  const { data, error } = await supabase.from("integration_inbound_events").insert(row).select().single();
  if (error) return { data: null, error: error as Error };
  return { data: data as Record<string, unknown>, error: null };
}

export async function insertWebhookEventSecure(
  supabase: SupabaseClient,
  eventRow: WebhookEventInsert
): Promise<{ data: Record<string, unknown> | null; error: Error | null }> {
  const orgId = await resolveOrgIdForIntegrationAccount(supabase, eventRow.integration_account_id);
  await assertOperationalIngestPersistAllowed(supabase, orgId);
  const schema = getFieldSchema(eventRow.provider);
  const normalize = getIngestionNormalizer(eventRow.provider);
  const result = secureIngest({
    source: `integration_webhook_events:${eventRow.provider}`,
    payload: eventRow.payload_json,
    schema,
    orgId,
    normalize,
  });

  if (shadowMode()) {
    safeLog("ingestion_shadow_webhook", {
      org_id: orgId,
      provider: eventRow.provider,
      redacted_count: result.audit.redacted_count,
      hashed_count: result.audit.hashed_count,
      dropped_count: result.audit.dropped_count,
    });
  }

  const webhookRow = {
    ...eventRow,
    sanitized_payload: shadowMode() ? null : result.normalized,
    payload_audit: shadowMode() ? null : result.audit,
    is_legacy: false,
  };

  const { data, error } = await supabase.from("integration_webhook_events").insert(webhookRow).select().single();
  if (error) return { data: null, error: error as Error };
  return { data: data as Record<string, unknown>, error: null };
}

export async function insertRawEventSecure(
  supabase: SupabaseClient,
  row: Omit<RawEventRow, "id" | "created_at" | "updated_at">
): Promise<{ data: RawEventRow | null; error: Error | null }> {
  await assertOperationalIngestPersistAllowed(supabase, row.org_id);
  const schema = getFieldSchema(row.provider);
  const normalize = getIngestionNormalizer(row.provider);
  const result = secureIngest({
    source: `raw_events:${row.provider}`,
    payload: row.payload_json,
    schema,
    orgId: row.org_id,
    normalize,
  });

  if (shadowMode()) {
    safeLog("ingestion_shadow_raw_event", {
      org_id: row.org_id,
      provider: row.provider,
      redacted_count: result.audit.redacted_count,
      hashed_count: result.audit.hashed_count,
      dropped_count: result.audit.dropped_count,
    });
  }

  const insertRow = {
    ...row,
    updated_at: new Date().toISOString(),
    sanitized_payload: shadowMode() ? null : result.normalized,
    payload_audit: shadowMode() ? null : result.audit,
    is_legacy: false,
  };

  const { data, error } = await supabase.from("raw_events").insert(insertRow).select().single();
  if (error) return { data: null, error: error as Error };
  return { data: data as RawEventRow, error: null };
}

/** Value-engine path: raw_events upsert with redaction + dual-write (must stay in ingestion boundary). */
export async function upsertValueEngineRawEvent(
  supabase: SupabaseClient,
  input: UpsertNormalizedRawEventInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await assertOperationalIngestPersistAllowed(supabase, input.orgId);
  const extId = input.externalId.trim();
  if (!extId) return { ok: false, error: "externalId required" };

  const ingestedAt = new Date().toISOString();
  const fingerprint = computeEventFingerprint(input.orgId, input.provider, extId, input.eventType);
  const payloadHash = computePayloadHash(input.payload);
  const idempotencyKey = `ve:${input.provider}:${extId}:${input.eventType}`;

  const schema = getFieldSchema(input.provider);
  const normalize = getIngestionNormalizer(input.provider);
  const ingested = secureIngest({
    source: `raw_events:upsert:${input.provider}`,
    payload: input.payload,
    schema,
    orgId: input.orgId,
    normalize,
  });

  if (shadowMode()) {
    safeLog("ingestion_shadow_raw_upsert", {
      org_id: input.orgId,
      provider: input.provider,
      redacted_count: ingested.audit.redacted_count,
      hashed_count: ingested.audit.hashed_count,
      dropped_count: ingested.audit.dropped_count,
    });
  }

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
    sanitized_payload: shadowMode() ? null : ingested.normalized,
    payload_audit: shadowMode() ? null : ingested.audit,
    is_legacy: false,
    updated_at: ingestedAt,
  };

  const { data, error } = await supabase
    .from("raw_events")
    .upsert(row, { onConflict: "org_id,provider,external_id,event_type" })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  if (!data?.id) return { ok: false, error: "upsert returned no id" };
  return { ok: true, id: data.id as string };
}

export async function insertDeadLetterSecure(
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
): Promise<{ data: Record<string, unknown> | null; error: Error | null }> {
  const payload = input.payload_json ?? {};
  const schema = getFieldSchema(input.provider);
  const normalize = getIngestionNormalizer(input.provider);
  const result = secureIngest({
    source: `integration_dead_letters:${input.provider}`,
    payload,
    schema,
    orgId: input.org_id,
    normalize,
  });

  const row = {
    org_id: input.org_id,
    provider: input.provider,
    dead_letter_type: input.dead_letter_type,
    source_record_id: input.source_record_id,
    reason_code: input.reason_code,
    reason_message: input.reason_message,
    payload_json: payload,
    retryable: input.retryable ?? true,
    sanitized_payload: shadowMode() ? null : result.normalized,
    payload_audit: shadowMode() ? null : result.audit,
    is_legacy: false,
  };

  const { data, error } = await supabase.from("integration_dead_letters").insert(row).select().single();
  if (error) return { data: null, error: error as Error };
  return { data: data as Record<string, unknown>, error: null };
}
