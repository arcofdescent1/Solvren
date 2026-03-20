/**
 * Phase 1 — Webhook ingestion (§11). Receives provider events, persists, optional signature verification.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { IntegrationProvider } from "../contracts/types";
import { insertWebhookEvent } from "../core/integrationWebhookRepo";
import type { WebhookProcessedStatus } from "../contracts/types";

export type IngestWebhookParams = {
  provider: IntegrationProvider;
  integrationAccountId?: string | null;
  eventType: string;
  payload: unknown;
  headers?: Record<string, string>;
  rawBody?: string;
  signatureValid?: boolean;
  externalEventId?: string | null;
  dedupeKey?: string | null;
};

export async function ingestWebhook(
  supabase: SupabaseClient,
  params: IngestWebhookParams
): Promise<{ eventId: string; processedStatus: WebhookProcessedStatus; error?: string }> {
  const dedupeKey = params.dedupeKey ?? params.externalEventId ?? null;
  const { data: row, error } = await insertWebhookEvent(supabase, {
    integration_account_id: params.integrationAccountId ?? null,
    provider: params.provider,
    external_event_id: params.externalEventId ?? null,
    event_type: params.eventType,
    request_headers_json: (params.headers ?? {}) as Record<string, unknown>,
    payload_json: (typeof params.payload === "object" && params.payload !== null ? params.payload : { raw: params.payload }) as Record<string, unknown>,
    signature_valid: params.signatureValid ?? null,
    processed_status: "received",
    processed_at: null,
    processing_error_json: null,
    dedupe_key: dedupeKey,
  });
  if (error) {
    if (error.message?.includes("duplicate") || (error as { code?: string }).code === "23505") {
      return { eventId: "", processedStatus: "duplicate", error: "Duplicate event" };
    }
    return { eventId: "", processedStatus: "failed", error: error.message };
  }
  return { eventId: row?.id ?? "", processedStatus: "received" };
}
