/**
 * Phase 4 — Inbound replay service (§6).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getInboundEventById,
  listInboundEventsForReplay,
  updateInboundEventStatus,
} from "../repositories/integration-inbound-events.repository";
import { assertValidInboundTransition, isValidInboundTransition as checkTransition } from "./inbound-status-machine";

export type ReplayInboundResult =
  | { ok: true; replayed: number; eventIds: string[] }
  | { ok: false; error: string };

export async function replayInboundEventById(
  supabase: SupabaseClient,
  eventId: string,
  options?: { forceReprocess?: boolean }
): Promise<ReplayInboundResult> {
  const { data: evt } = await getInboundEventById(supabase, eventId);
  if (!evt) return { ok: false, error: "Event not found" };

  const status = evt.ingest_status as string;
  if (status === "PROCESSED" && !options?.forceReprocess) {
    return { ok: false, error: "Event already processed. Use forceReprocess to replay." };
  }
  if (!["FAILED", "DEAD_LETTERED", "PROCESSED"].includes(status)) {
    return { ok: false, error: `Cannot replay event in status ${status}` };
  }

  const fromStatus = status as "FAILED" | "DEAD_LETTERED" | "PROCESSED";
  assertValidInboundTransition(fromStatus, "QUEUED");

  const replayCount = (evt.replay_count ?? 0) + 1;
  await updateInboundEventStatus(supabase, eventId, {
    ingest_status: "QUEUED",
    replayed_at: new Date().toISOString(),
    replay_reason: options?.forceReprocess ? "admin_force" : "retry",
    replay_count: replayCount,
    last_processing_error_code: null,
    last_processing_error_message: null,
  });

  return { ok: true, replayed: 1, eventIds: [eventId] };
}

export async function replayInboundEventsInRange(
  supabase: SupabaseClient,
  params: {
    integrationAccountId?: string;
    fromReceived: string;
    toReceived: string;
  }
): Promise<ReplayInboundResult> {
  const { data: events } = await listInboundEventsForReplay(supabase, {
    integrationAccountId: params.integrationAccountId,
    fromReceived: params.fromReceived,
    toReceived: params.toReceived,
    statuses: ["FAILED", "DEAD_LETTERED"],
  });

  const eventIds: string[] = [];
  for (const evt of events) {
    const fromStatus = evt.ingest_status as "FAILED" | "DEAD_LETTERED";
    if (checkTransition(fromStatus, "QUEUED")) {
      const replayCount = (evt.replay_count ?? 0) + 1;
      await updateInboundEventStatus(supabase, evt.id, {
        ingest_status: "QUEUED",
        replayed_at: new Date().toISOString(),
        replay_reason: "batch_retry",
        replay_count: replayCount,
        last_processing_error_code: null,
        last_processing_error_message: null,
      });
      eventIds.push(evt.id);
    }
  }

  return { ok: true, replayed: eventIds.length, eventIds };
}
