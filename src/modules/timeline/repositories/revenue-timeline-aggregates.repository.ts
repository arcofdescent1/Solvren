/**
 * Phase 7 — Revenue timeline aggregates repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type RevenueTimelineAggregateRow = {
  id: string;
  org_id: string;
  aggregate_type: string;
  aggregate_key: string;
  window_start: string;
  window_end: string;
  event_count: number;
  recovered_amount: number;
  avoided_amount: number;
  savings_amount: number;
  loss_amount: number;
  metrics_json: Record<string, unknown>;
  updated_at: string;
};

export async function getAggregate(
  supabase: SupabaseClient,
  orgId: string,
  aggregateType: string,
  aggregateKey: string
): Promise<{ data: RevenueTimelineAggregateRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("revenue_timeline_aggregates")
    .select("*")
    .eq("org_id", orgId)
    .eq("aggregate_type", aggregateType)
    .eq("aggregate_key", aggregateKey)
    .maybeSingle();
  return { data: data as RevenueTimelineAggregateRow | null, error: error as Error | null };
}

export async function upsertAggregate(
  supabase: SupabaseClient,
  input: Omit<RevenueTimelineAggregateRow, "id" | "updated_at">
): Promise<{ data: RevenueTimelineAggregateRow | null; error: Error | null }> {
  const row = {
    ...input,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("revenue_timeline_aggregates")
    .upsert(row as Record<string, unknown>, {
      onConflict: "org_id,aggregate_type,aggregate_key",
    })
    .select()
    .single();
  if (error) return { data: null, error: error as Error };
  return { data: data as RevenueTimelineAggregateRow, error: null };
}
