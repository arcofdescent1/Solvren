/**
 * Phase 4 — Inbound processor (§14). Moves integration_inbound_events → raw_events.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  listInboundEventsForProcessing,
  getInboundEventById,
  updateInboundEventStatus,
} from "../repositories/integration-inbound-events.repository";
import { assertValidInboundTransition } from "./inbound-status-machine";
import { intakeRawEvent } from "@/modules/signals/ingestion/raw-event-intake.service";
import { insertDeadLetter } from "../repositories/integration-dead-letters.repository";
import { classifyInboundError, isInboundErrorRetryable } from "./inbound-error-classifier";
import type { IntegrationInboundEventRow } from "../repositories/integration-inbound-events.repository";

const MAX_PROCESSING_ATTEMPTS = 4;

export async function processInboundBatch(
  supabase: SupabaseClient,
  limit = 50
): Promise<{ processed: number; failed: number; deadLettered: number }> {
  const { data: events } = await listInboundEventsForProcessing(supabase, limit);
  let processed = 0;
  let failed = 0;
  let deadLettered = 0;

  for (const evt of events) {
    const result = await processOneInboundEvent(supabase, evt);
    if (result === "processed") processed++;
    else if (result === "failed") failed++;
    else deadLettered++;
  }

  return { processed, failed, deadLettered };
}

export async function processOneInboundEvent(
  supabase: SupabaseClient,
  evt: IntegrationInboundEventRow
): Promise<"processed" | "failed" | "dead_lettered"> {
  const status = evt.ingest_status as "RECEIVED" | "VALIDATED" | "QUEUED";
  const nextStatus = "QUEUED" as const;
  if (status === "RECEIVED" || status === "VALIDATED") {
    assertValidInboundTransition(status, nextStatus);
    await updateInboundEventStatus(supabase, evt.id, { ingest_status: nextStatus });
  }

  const payload = evt.payload_json ?? {};
  const obj =
    (payload as { data?: { object?: unknown } }).data?.object ??
    (payload as { object?: unknown }).object ??
    payload;

  const intakeResult = await intakeRawEvent(supabase, {
    orgId: evt.org_id,
    integrationAccountId: evt.integration_account_id,
    provider: evt.provider,
    sourceChannel: mapInboundSourceToRaw(evt.source_channel),
    externalEventId: evt.external_event_id,
    externalObjectType: evt.external_object_type,
    externalObjectId: evt.external_object_id,
    eventType: evt.event_type,
    eventTime: evt.event_time,
    payload: typeof obj === "object" && obj !== null ? (obj as Record<string, unknown>) : payload,
    headers: (evt.headers_json ?? null) as Record<string, unknown> | null,
  });

  if (intakeResult.ok) {
    assertValidInboundTransition("QUEUED", "PROCESSED");
    await updateInboundEventStatus(supabase, evt.id, {
      ingest_status: "PROCESSED",
      downstream_raw_event_id: intakeResult.rawEventId,
      last_processing_error_code: null,
      last_processing_error_message: null,
    });
    return "processed";
  }

  const attempts = (evt.processing_attempts ?? 0) + 1;
  const errorCode = classifyInboundError(intakeResult.error);
  const retryable = isInboundErrorRetryable(errorCode, intakeResult.error);

  await updateInboundEventStatus(supabase, evt.id, {
    processing_attempts: attempts,
    last_processing_error_code: errorCode,
    last_processing_error_message: intakeResult.error,
    ingest_status: retryable && attempts < MAX_PROCESSING_ATTEMPTS ? "FAILED" : "DEAD_LETTERED",
  });

  if (!retryable || attempts >= MAX_PROCESSING_ATTEMPTS) {
    await insertDeadLetter(supabase, {
      org_id: evt.org_id,
      provider: evt.provider,
      dead_letter_type: "INBOUND_EVENT",
      source_record_id: evt.id,
      reason_code: errorCode,
      reason_message: intakeResult.error,
      payload_json: { inbound_event_id: evt.id, error: intakeResult.error },
      retryable: false,
    });
    return "dead_lettered";
  }

  return "failed";
}

function mapInboundSourceToRaw(channel: string): string {
  if (channel === "reconcile" || channel === "salesforce_cdc") return "webhook";
  return channel;
}
