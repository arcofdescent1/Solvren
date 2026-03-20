/**
 * Phase 6 — Benchmark query service (§16.7).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BenchmarkResult } from "../domain/benchmark-result";
import { BenchmarkConfidenceBand } from "../domain/benchmark-confidence-band";
import {
  getBenchmarkMetric,
  listBenchmarkMetrics,
} from "../repositories/benchmark-metrics.repository";
import { getBenchmarkCohort } from "../repositories/benchmark-cohorts.repository";
import { getLatestSnapshot } from "../repositories/benchmark-snapshots.repository";
import { insertBenchmarkResultLog } from "../repositories/benchmark-result-logs.repository";
import { shouldDisplayBenchmark } from "./benchmark-surfacing.service";

export type GetBenchmarkResultOptions = {
  /** When false, skips benchmark_result_logs insert (e.g. batch list endpoint). Default true. */
  persistLog?: boolean;
};

export async function getBenchmarkResult(
  supabase: SupabaseClient,
  orgId: string,
  metricKey: string,
  cohortKey = "default",
  customerValue: number | null = null,
  options?: GetBenchmarkResultOptions
): Promise<{ data: BenchmarkResult; error: Error | null }> {
  const persistLog = options?.persistLog !== false;
  const { data: metric, error: metricErr } = await getBenchmarkMetric(
    supabase,
    metricKey
  );
  if (metricErr || !metric) {
    return {
      data: buildHiddenResult(metricKey, "Unknown metric", "insufficient_org_count"),
      error: metricErr ?? new Error("Metric not found"),
    };
  }

  const { data: cohort, error: cohortErr } = await getBenchmarkCohort(
    supabase,
    cohortKey
  );
  if (cohortErr || !cohort) {
    return {
      data: buildHiddenResult(metricKey, metric.display_name, "insufficient_org_count"),
      error: cohortErr ?? new Error("Cohort not found"),
    };
  }

  const { data: snapshot, error: snapErr } = await getLatestSnapshot(
    supabase,
    cohort.id,
    metric.id
  );

  if (snapErr || !snapshot) {
    const result = buildHiddenResult(
      metricKey,
      metric.display_name,
      "insufficient_org_count"
    );
    if (persistLog) {
      await insertBenchmarkResultLog(supabase, {
        org_id: orgId,
        metric_key: metricKey,
        cohort_key: cohortKey,
        snapshot_id: null,
        customer_value: customerValue,
        percentile_rank: null,
        normalized_gap: null,
        confidence_score: 0,
        confidence_band: "VERY_LOW",
        safe_to_display: false,
        hidden_reason_code: "insufficient_org_count",
      });
    }
    return { data: result, error: null };
  }

  const snapshotTime = new Date(snapshot.snapshot_time);
  const ageDays = (Date.now() - snapshotTime.getTime()) / (1000 * 60 * 60 * 24);
  const band = snapshot.confidence_band as BenchmarkConfidenceBand;

  const surfacing = shouldDisplayBenchmark({
    orgCount: snapshot.org_count,
    metricCoverageRate: snapshot.metric_coverage_rate,
    confidenceBand: band,
    confidenceScore: snapshot.confidence_score,
    customerVisible: metric.customer_visible,
    customerValueAvailable: customerValue != null,
    snapshotAgeDays: ageDays,
    minOrgCount: metric.minimum_org_count,
    minCoverageRate: metric.minimum_coverage_rate,
  });

  let percentileRank: number | null = null;
  let normalizedGap: number | null = null;
  let explanationText = "Not enough data for benchmark yet.";

  if (surfacing.safeToDisplay && customerValue != null && snapshot.median_value != null) {
    const med = snapshot.median_value;
    const p25 = snapshot.p25_value ?? med;
    const p75 = snapshot.p75_value ?? med;
    const higherIsBetter = metric.higher_is_better;
    normalizedGap = higherIsBetter
      ? customerValue - med
      : med - customerValue;
    percentileRank = 50;
    if (customerValue < p25) percentileRank = 25;
    else if (customerValue < med) percentileRank = 37;
    else if (customerValue < p75) percentileRank = 62;
    else if (customerValue > p75) percentileRank = 75;

    const dir = normalizedGap! > 0 ? "above" : "below";
    explanationText = `Your ${metric.display_name.toLowerCase()} is ${dir} the median for similar companies in your cohort.`;
  } else if (surfacing.safeToDisplay) {
    explanationText = `Cohort median: ${snapshot.median_value?.toFixed(2) ?? "N/A"}. Add your data to see personalized comparison.`;
  }

  const result: BenchmarkResult = {
    metricKey,
    displayName: metric.display_name,
    snapshotTime: snapshotTime.toISOString(),
    customerValue,
    cohortMedian: surfacing.safeToDisplay ? snapshot.median_value : null,
    cohortP25: surfacing.safeToDisplay ? snapshot.p25_value : null,
    cohortP75: surfacing.safeToDisplay ? snapshot.p75_value : null,
    percentileRank,
    normalizedGap,
    confidenceScore: snapshot.confidence_score,
    confidenceBand: band,
    cohortOrgCount: surfacing.safeToDisplay ? snapshot.org_count : 0,
    metricCoverageRate: surfacing.safeToDisplay ? snapshot.metric_coverage_rate : 0,
    safeToDisplay: surfacing.safeToDisplay,
    hiddenReasonCode: surfacing.hiddenReasonCode,
    explanationText,
  };

  if (persistLog) {
    await insertBenchmarkResultLog(supabase, {
      org_id: orgId,
      metric_key: metricKey,
      cohort_key: cohortKey,
      snapshot_id: snapshot.id,
      customer_value: customerValue,
      percentile_rank: percentileRank,
      normalized_gap: normalizedGap,
      confidence_score: snapshot.confidence_score,
      confidence_band: snapshot.confidence_band,
      safe_to_display: surfacing.safeToDisplay,
      hidden_reason_code: surfacing.hiddenReasonCode,
    });
  }

  return { data: result, error: null };
}

/**
 * Batch benchmark results for customer-visible metrics (e.g. GET /api/benchmarks).
 * Does not write benchmark_result_logs per metric to avoid write amplification.
 */
export async function listCustomerVisibleBenchmarkResults(
  supabase: SupabaseClient,
  orgId: string,
  cohortKey = "default",
  customerValuesByMetricKey?: Record<string, number | null>
): Promise<{ data: BenchmarkResult[]; error: Error | null }> {
  const { data: metrics, error: listErr } = await listBenchmarkMetrics(supabase, {
    customerVisibleOnly: true,
  });
  if (listErr) {
    return { data: [], error: listErr };
  }
  const results: BenchmarkResult[] = [];
  for (const m of metrics) {
    const cv =
      customerValuesByMetricKey?.[m.metric_key] ??
      customerValuesByMetricKey?.[m.metric_key.trim()] ??
      null;
    const { data, error } = await getBenchmarkResult(
      supabase,
      orgId,
      m.metric_key,
      cohortKey,
      cv,
      { persistLog: false }
    );
    if (error) continue;
    results.push(data);
  }
  return { data: results, error: null };
}

function buildHiddenResult(
  metricKey: string,
  displayName: string,
  hiddenReasonCode: string
): BenchmarkResult {
  return {
    metricKey,
    displayName,
    snapshotTime: new Date().toISOString(),
    customerValue: null,
    cohortMedian: null,
    cohortP25: null,
    cohortP75: null,
    percentileRank: null,
    normalizedGap: null,
    confidenceScore: 0,
    confidenceBand: BenchmarkConfidenceBand.VERY_LOW,
    cohortOrgCount: 0,
    metricCoverageRate: 0,
    safeToDisplay: false,
    hiddenReasonCode,
    explanationText: "Not enough data for benchmark yet.",
  };
}
