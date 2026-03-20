/**
 * Phase 6 — Benchmark surfacing service (§13).
 */
import { BenchmarkConfidenceBand } from "../domain/benchmark-confidence-band";

export const HIDDEN_REASON_CODES = {
  insufficient_org_count: "insufficient_org_count",
  insufficient_metric_coverage: "insufficient_metric_coverage",
  low_confidence: "low_confidence",
  customer_data_missing: "customer_data_missing",
  metric_not_customer_visible: "metric_not_customer_visible",
  privacy_suppressed: "privacy_suppressed",
  stale_snapshot: "stale_snapshot",
} as const;

export type SurfacingInput = {
  orgCount: number;
  metricCoverageRate: number;
  confidenceBand: BenchmarkConfidenceBand;
  confidenceScore: number;
  customerVisible: boolean;
  customerValueAvailable: boolean;
  snapshotAgeDays: number;
  minOrgCount: number;
  minCoverageRate: number;
  isRecommendationBacked?: boolean;
};

export function shouldDisplayBenchmark(input: SurfacingInput): {
  safeToDisplay: boolean;
  hiddenReasonCode: string | null;
} {
  if (!input.customerVisible) {
    return { safeToDisplay: false, hiddenReasonCode: HIDDEN_REASON_CODES.metric_not_customer_visible };
  }
  if (input.orgCount < input.minOrgCount) {
    return { safeToDisplay: false, hiddenReasonCode: HIDDEN_REASON_CODES.insufficient_org_count };
  }
  if (input.metricCoverageRate < input.minCoverageRate) {
    return { safeToDisplay: false, hiddenReasonCode: HIDDEN_REASON_CODES.insufficient_metric_coverage };
  }
  const minConfidence = input.isRecommendationBacked
    ? BenchmarkConfidenceBand.HIGH
    : BenchmarkConfidenceBand.MODERATE;
  if (!meetsConfidenceThreshold(input.confidenceBand, minConfidence)) {
    return { safeToDisplay: false, hiddenReasonCode: HIDDEN_REASON_CODES.low_confidence };
  }
  if (input.snapshotAgeDays > 7 && input.snapshotAgeDays <= 30) {
  } else if (input.snapshotAgeDays > 30) {
    return { safeToDisplay: false, hiddenReasonCode: HIDDEN_REASON_CODES.stale_snapshot };
  }
  return { safeToDisplay: true, hiddenReasonCode: null };
}

const BAND_ORDER: BenchmarkConfidenceBand[] = [
  BenchmarkConfidenceBand.VERY_LOW,
  BenchmarkConfidenceBand.LOW,
  BenchmarkConfidenceBand.MODERATE,
  BenchmarkConfidenceBand.HIGH,
  BenchmarkConfidenceBand.VERY_HIGH,
];

function meetsConfidenceThreshold(
  band: BenchmarkConfidenceBand,
  minBand: BenchmarkConfidenceBand
): boolean {
  const bandIdx = BAND_ORDER.indexOf(band);
  const minIdx = BAND_ORDER.indexOf(minBand);
  return bandIdx >= minIdx;
}
