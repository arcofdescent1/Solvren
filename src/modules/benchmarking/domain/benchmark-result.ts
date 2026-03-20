/**
 * Phase 6 — Benchmark result contract (§11).
 */
import type { BenchmarkConfidenceBand } from "./benchmark-confidence-band";

export type BenchmarkResult = {
  metricKey: string;
  displayName: string;
  snapshotTime: string;

  customerValue: number | null;
  cohortMedian: number | null;
  cohortP25: number | null;
  cohortP75: number | null;

  percentileRank: number | null;
  normalizedGap: number | null;

  confidenceScore: number;
  confidenceBand: BenchmarkConfidenceBand;

  cohortOrgCount: number;
  metricCoverageRate: number;

  safeToDisplay: boolean;
  hiddenReasonCode?: string | null;

  explanationText: string;
};
