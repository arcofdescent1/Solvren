/**
 * Phase 6 — Benchmark snapshots repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type BenchmarkSnapshotRow = {
  id: string;
  cohort_id: string;
  metric_id: string;
  snapshot_time: string;
  org_count: number;
  metric_coverage_rate: number;
  median_value: number | null;
  p25_value: number | null;
  p75_value: number | null;
  mean_value: number | null;
  stddev_value: number | null;
  confidence_score: number;
  confidence_band: string;
  metrics_json: Record<string, unknown>;
  reasons_json: unknown[];
  created_at: string;
};

export async function getLatestSnapshot(
  supabase: SupabaseClient,
  cohortId: string,
  metricId: string
): Promise<{ data: BenchmarkSnapshotRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("benchmark_snapshots")
    .select("*")
    .eq("cohort_id", cohortId)
    .eq("metric_id", metricId)
    .order("snapshot_time", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { data: data as BenchmarkSnapshotRow | null, error: error as Error | null };
}

export async function insertBenchmarkSnapshot(
  supabase: SupabaseClient,
  input: Omit<BenchmarkSnapshotRow, "id" | "created_at">
): Promise<{ data: BenchmarkSnapshotRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("benchmark_snapshots")
    .insert(input as Record<string, unknown>)
    .select()
    .single();
  if (error) return { data: null, error: error as Error };
  return { data: data as BenchmarkSnapshotRow, error: null };
}
