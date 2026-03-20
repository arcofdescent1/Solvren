/**
 * Phase 7 — Timeline aggregate service (§17).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAggregate, upsertAggregate } from "../repositories/revenue-timeline-aggregates.repository";

export type AggregateWindow = "DAILY" | "WEEKLY" | "MONTHLY" | "TRAILING_30";

export async function getTimelineAggregates(
  supabase: SupabaseClient,
  orgId: string,
  window: AggregateWindow = "TRAILING_30"
): Promise<{
  recoveredAmount: number;
  avoidedAmount: number;
  savingsAmount: number;
  lossAmount: number;
  eventCount: number;
  error: Error | null;
}> {
  const key = window === "TRAILING_30" ? "trailing_30d" : window.toLowerCase();
  const { data, error } = await getAggregate(supabase, orgId, window, key);
  if (error) {
    return {
      recoveredAmount: 0,
      avoidedAmount: 0,
      savingsAmount: 0,
      lossAmount: 0,
      eventCount: 0,
      error,
    };
  }
  return {
    recoveredAmount: data?.recovered_amount ?? 0,
    avoidedAmount: data?.avoided_amount ?? 0,
    savingsAmount: data?.savings_amount ?? 0,
    lossAmount: data?.loss_amount ?? 0,
    eventCount: data?.event_count ?? 0,
    error: null,
  };
}

export async function refreshTimelineAggregates(
  orgId: string,
  window: AggregateWindow
): Promise<{ error: Error | null }> {
  const admin = createAdminClient();
  const now = new Date();
  let windowStart: Date;
  let key: string;

  switch (window) {
    case "DAILY":
      windowStart = new Date(now);
      windowStart.setDate(windowStart.getDate() - 1);
      key = now.toISOString().slice(0, 10);
      break;
    case "WEEKLY":
      windowStart = new Date(now);
      windowStart.setDate(windowStart.getDate() - 7);
      key = `w_${now.toISOString().slice(0, 10)}`;
      break;
    case "MONTHLY":
      windowStart = new Date(now);
      windowStart.setMonth(windowStart.getMonth() - 1);
      key = now.toISOString().slice(0, 7);
      break;
    case "TRAILING_30":
    default:
      windowStart = new Date(now);
      windowStart.setDate(windowStart.getDate() - 30);
      key = "trailing_30d";
      break;
  }

  const { data: events } = await admin
    .from("revenue_timeline_events")
    .select("amount, value_type")
    .eq("org_id", orgId)
    .gte("event_time", windowStart.toISOString())
    .lte("event_time", now.toISOString());

  const rows = (events ?? []) as { amount: number | null; value_type: string | null }[];
  let recovered = 0;
  let avoided = 0;
  let savings = 0;
  let loss = 0;
  for (const r of rows) {
    const amt = r.amount ?? 0;
    switch (r.value_type) {
      case "RECOVERED":
        recovered += amt;
        break;
      case "AVOIDED":
        avoided += amt;
        break;
      case "SAVINGS":
        savings += amt;
        break;
      case "LOSS":
        loss += amt;
        break;
    }
  }

  const { error } = await upsertAggregate(admin, {
    org_id: orgId,
    aggregate_type: window,
    aggregate_key: key,
    window_start: windowStart.toISOString(),
    window_end: now.toISOString(),
    event_count: rows.length,
    recovered_amount: recovered,
    avoided_amount: avoided,
    savings_amount: savings,
    loss_amount: loss,
    metrics_json: {},
  });

  return { error };
}
