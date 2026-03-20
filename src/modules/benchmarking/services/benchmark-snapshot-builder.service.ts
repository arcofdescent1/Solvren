/**
 * Phase 6 — Benchmark snapshot builder service (§16.3).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBenchmarkMetric } from "../repositories/benchmark-metrics.repository";
import { getBenchmarkCohort } from "../repositories/benchmark-cohorts.repository";
import { insertBenchmarkSnapshot } from "../repositories/benchmark-snapshots.repository";
import { buildCohort } from "./cohort-builder.service";
import { fetchMetricValuesForOrgs } from "./metric-value-source.service";
import {
  computeConfidenceScore,
  computeConfidenceBand,
  confidenceReasons,
} from "./benchmark-confidence.service";

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (idx - lo) * (sorted[hi]! - sorted[lo]!);
}

function median(values: number[]): number {
  return percentile(values, 50);
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  const sq = values.reduce((s, v) => s + (v - m) ** 2, 0);
  return Math.sqrt(sq / (values.length - 1));
}

export async function buildBenchmarkSnapshot(
  supabase: SupabaseClient,
  cohortKey: string,
  metricKey: string,
  snapshotTime: Date
): Promise<{ success: boolean; error?: string }> {
  const { data: metric, error: metricErr } = await getBenchmarkMetric(
    supabase,
    metricKey
  );
  if (metricErr || !metric) {
    return { success: false, error: "Metric not found" };
  }

  const { data: cohort, error: cohortErr } = await getBenchmarkCohort(
    supabase,
    cohortKey
  );
  if (cohortErr || !cohort) {
    return { success: false, error: "Cohort not found" };
  }

  const { data: cohortBuild, error: buildErr } = await buildCohort(
    supabase,
    cohortKey,
    metricKey,
    snapshotTime.toISOString()
  );
  if (buildErr || !cohortBuild) {
    return { success: false, error: "Failed to build cohort" };
  }

  if (cohortBuild.orgCount < metric.minimum_org_count) {
    return { success: false, error: "Insufficient org count" };
  }

  const windowEnd = new Date(snapshotTime);
  const windowStart = new Date(snapshotTime);
  windowStart.setDate(windowStart.getDate() - 90);

  const values = await fetchMetricValuesForOrgs(
    supabase,
    metricKey,
    cohortBuild.orgIds,
    windowStart,
    windowEnd
  );

  const validValues = values.filter((v) => v.hasData).map((v) => v.value);
  const coverageRate =
    cohortBuild.orgCount > 0 ? validValues.length / cohortBuild.orgCount : 0;

  if (coverageRate < metric.minimum_coverage_rate) {
    return { success: false, error: "Insufficient metric coverage" };
  }

  const medianVal = validValues.length > 0 ? median(validValues) : 0;
  const p25Val = validValues.length > 0 ? percentile(validValues, 25) : 0;
  const p75Val = validValues.length > 0 ? percentile(validValues, 75) : 0;
  const meanVal =
    validValues.length > 0
      ? validValues.reduce((a, b) => a + b, 0) / validValues.length
      : 0;
  const stddevVal = validValues.length > 1 ? stddev(validValues) : 0;

  const spread = medianVal > 0 ? stddevVal / medianVal : 0;
  const confidenceScore = computeConfidenceScore({
    orgCount: cohortBuild.orgCount,
    metricCoverageRate: coverageRate,
    varianceSpread: spread,
    dataRecencyDays: 0,
  });
  const confidenceBand = computeConfidenceBand(confidenceScore);
  const reasons = confidenceReasons({
    orgCount: cohortBuild.orgCount,
    metricCoverageRate: coverageRate,
    varianceSpread: spread,
  });

  const { error: insertErr } = await insertBenchmarkSnapshot(supabase, {
    cohort_id: cohort.id,
    metric_id: metric.id,
    snapshot_time: snapshotTime.toISOString(),
    org_count: cohortBuild.orgCount,
    metric_coverage_rate: coverageRate,
    median_value: medianVal,
    p25_value: p25Val,
    p75_value: p75Val,
    mean_value: meanVal,
    stddev_value: stddevVal,
    confidence_score: confidenceScore,
    confidence_band: confidenceBand,
    metrics_json: { validCount: validValues.length },
    reasons_json: reasons,
  });

  if (insertErr) return { success: false, error: insertErr.message };
  return { success: true };
}
