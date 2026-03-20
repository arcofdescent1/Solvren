/**
 * Phase 6 — Benchmark result logs repository (§14.5).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function insertBenchmarkResultLog(
  supabase: SupabaseClient,
  input: {
    org_id: string;
    metric_key: string;
    cohort_key: string;
    snapshot_id: string | null;
    customer_value: number | null;
    percentile_rank: number | null;
    normalized_gap: number | null;
    confidence_score: number;
    confidence_band: string;
    safe_to_display: boolean;
    hidden_reason_code: string | null;
  }
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("benchmark_result_logs").insert(input as Record<string, unknown>);
  return { error: error as Error | null };
}
