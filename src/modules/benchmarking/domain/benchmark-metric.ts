/**
 * Phase 6 — Benchmark metric (§9).
 */
import type { BenchmarkNormalizationMethod } from "./normalization-method";

export type BenchmarkMetricDefinition = {
  metricKey: string;
  displayName: string;
  description: string;
  category: string;
  unitType: string;
  normalizationMethod: BenchmarkNormalizationMethod;
  minimumOrgCount: number;
  minimumCoverageRate: number;
  customerVisible: boolean;
  higherIsBetter: boolean;
  metricVersion: string;
};
