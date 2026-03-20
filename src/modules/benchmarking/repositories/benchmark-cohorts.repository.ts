/**
 * Phase 6 — Benchmark cohorts repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type BenchmarkCohortRow = {
  id: string;
  cohort_key: string;
  display_name: string;
  cohort_definition_json: Record<string, unknown>;
  minimum_org_count: number;
  status: string;
  created_at: string;
};

export async function getBenchmarkCohort(
  supabase: SupabaseClient,
  cohortKey: string
): Promise<{ data: BenchmarkCohortRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("benchmark_cohorts")
    .select("*")
    .eq("cohort_key", cohortKey)
    .eq("status", "active")
    .maybeSingle();
  return { data: data as BenchmarkCohortRow | null, error: error as Error | null };
}

export async function listBenchmarkCohorts(
  supabase: SupabaseClient
): Promise<{ data: BenchmarkCohortRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("benchmark_cohorts")
    .select("*")
    .eq("status", "active");
  return { data: (data ?? []) as BenchmarkCohortRow[], error: error as Error | null };
}
