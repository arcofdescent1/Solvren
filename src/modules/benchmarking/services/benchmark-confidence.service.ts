/**
 * Phase 6 — Benchmark confidence service (§12).
 */
import {
  BenchmarkConfidenceBand,
  scoreToBand,
} from "../domain/benchmark-confidence-band";

export type ConfidenceInputs = {
  orgCount: number;
  metricCoverageRate: number;
  varianceSpread?: number;
  dataRecencyDays?: number;
  normalizationQuality?: number;
  cohortCohesion?: number;
};

export function computeConfidenceScore(inputs: ConfidenceInputs): number {
  let score = 100;

  if (inputs.orgCount < 50) score -= (50 - inputs.orgCount) * 0.5;
  if (inputs.orgCount < 30) score -= 10;
  if (inputs.orgCount < 20) score -= 15;

  if (inputs.metricCoverageRate < 0.9) score -= (0.9 - inputs.metricCoverageRate) * 50;
  if (inputs.metricCoverageRate < 0.7) score -= 20;

  const variance = inputs.varianceSpread ?? 0;
  if (variance > 2) score -= Math.min(15, variance * 5);

  const recency = inputs.dataRecencyDays ?? 0;
  if (recency > 14) score -= Math.min(10, recency / 7);
  if (recency > 30) score -= 15;

  const norm = inputs.normalizationQuality ?? 1;
  if (norm < 1) score -= (1 - norm) * 10;

  const cohesion = inputs.cohortCohesion ?? 1;
  if (cohesion < 0.8) score -= (0.8 - cohesion) * 20;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function computeConfidenceBand(score: number): BenchmarkConfidenceBand {
  return scoreToBand(score);
}

export function confidenceReasons(inputs: ConfidenceInputs): string[] {
  const reasons: string[] = [];
  if (inputs.orgCount < 30) reasons.push("low_org_count");
  if (inputs.metricCoverageRate < 0.8) reasons.push("low_coverage");
  if ((inputs.varianceSpread ?? 0) > 2) reasons.push("high_variance");
  if ((inputs.dataRecencyDays ?? 0) > 30) reasons.push("stale_data");
  return reasons;
}
