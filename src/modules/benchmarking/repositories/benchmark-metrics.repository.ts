/**
 * Phase 6 — Benchmark metrics repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type BenchmarkMetricRow = {
  id: string;
  metric_key: string;
  display_name: string;
  description: string;
  category: string;
  unit_type: string;
  normalization_method: string;
  minimum_org_count: number;
  minimum_coverage_rate: number;
  customer_visible: boolean;
  metric_version: string;
  higher_is_better: boolean;
  created_at: string;
  updated_at: string;
};

export async function getBenchmarkMetric(
  supabase: SupabaseClient,
  metricKey: string,
  version = "1.0"
): Promise<{ data: BenchmarkMetricRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("benchmark_metrics")
    .select("*")
    .eq("metric_key", metricKey)
    .eq("metric_version", version)
    .maybeSingle();
  return { data: data as BenchmarkMetricRow | null, error: error as Error | null };
}

export async function listBenchmarkMetrics(
  supabase: SupabaseClient,
  options?: { customerVisibleOnly?: boolean }
): Promise<{ data: BenchmarkMetricRow[]; error: Error | null }> {
  let q = supabase.from("benchmark_metrics").select("*");
  if (options?.customerVisibleOnly) {
    q = q.eq("customer_visible", true);
  }
  const { data, error } = await q;
  return { data: (data ?? []) as BenchmarkMetricRow[], error: error as Error | null };
}
