/**
 * Phase 3 — Replay service (§17). Re-queue raw events for reprocessing.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { processRawEvent } from "./signal-processor.service";
import { getRawEventById } from "../persistence/raw-events.repository";
import type { RawEventRow } from "../domain/types";

export type ReplayRequestInput = {
  orgId: string;
  requestedBy?: string | null;
  provider?: string;
  signalKey?: string;
  timeFrom?: string;
  timeTo?: string;
  rawEventIds?: string[];
  limit?: number;
};

export type ReplayResult = {
  replayRequestId: string;
  processingRunId: string;
  rawEventsMatched: number;
  rawEventsRequeued: number;
  signalsProduced: number;
  errorsCount: number;
};

export async function runReplay(
  supabase: SupabaseClient,
  input: ReplayRequestInput
): Promise<ReplayResult> {
  const limit = input.limit ?? 100;

  const { data: replayRow, error: replayErr } = await supabase
    .from("signal_replay_requests")
    .insert({
      org_id: input.orgId,
      requested_by: input.requestedBy ?? null,
      provider: input.provider ?? null,
      signal_key: input.signalKey ?? null,
      time_from: input.timeFrom ?? null,
      time_to: input.timeTo ?? null,
      status: "running",
    })
    .select("id")
    .single();
  if (replayErr || !replayRow) throw new Error("Failed to create replay request");
  const replayRequestId = (replayRow as { id: string }).id;

  const { data: runRow, error: runErr } = await supabase
    .from("signal_processing_runs")
    .insert({
      org_id: input.orgId,
      run_type: "replay",
      trigger_source: "admin_api",
      status: "running",
    })
    .select("id")
    .single();
  if (runErr || !runRow) throw new Error("Failed to create processing run");
  const processingRunId = (runRow as { id: string }).id;

  let rawEvents: RawEventRow[] = [];
  if (input.rawEventIds?.length) {
    for (const id of input.rawEventIds.slice(0, limit)) {
      const { data } = await getRawEventById(supabase, id);
      if (data && data.org_id === input.orgId) rawEvents.push(data);
    }
  } else {
    let q = supabase
      .from("raw_events")
      .select("*")
      .eq("org_id", input.orgId)
      .in("processing_status", ["processed", "failed"])
      .order("received_at", { ascending: true })
      .limit(limit);
    if (input.provider) q = q.eq("provider", input.provider);
    if (input.timeFrom) q = q.gte("received_at", input.timeFrom);
    if (input.timeTo) q = q.lte("received_at", input.timeTo);
    const { data } = await q;
    rawEvents = (data ?? []) as RawEventRow[];
  }

  for (const raw of rawEvents) {
    await supabase
      .from("raw_events")
      .update({ processing_status: "pending", updated_at: new Date().toISOString() })
      .eq("id", raw.id);
  }

  let signalsProduced = 0;
  let errorsCount = 0;
  for (const raw of rawEvents) {
    const result = await processRawEvent(supabase, raw);
    if (result.ok) signalsProduced++;
    else errorsCount++;
  }

  await supabase
    .from("signal_processing_runs")
    .update({
      status: "completed",
      raw_events_processed: rawEvents.length,
      signals_produced: signalsProduced,
      errors_count: errorsCount,
      completed_at: new Date().toISOString(),
    })
    .eq("id", processingRunId);

  await supabase
    .from("signal_replay_requests")
    .update({
      status: "completed",
      raw_events_matched: rawEvents.length,
      signals_produced: signalsProduced,
      errors_count: errorsCount,
      processing_run_id: processingRunId,
      completed_at: new Date().toISOString(),
    })
    .eq("id", replayRequestId);

  return {
    replayRequestId,
    processingRunId,
    rawEventsMatched: rawEvents.length,
    rawEventsRequeued: rawEvents.length,
    signalsProduced,
    errorsCount,
  };
}
