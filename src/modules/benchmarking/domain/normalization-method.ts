/**
 * Phase 6 — Benchmark normalization methods (§10.2).
 */
export enum BenchmarkNormalizationMethod {
  NONE = "NONE",
  PER_100 = "PER_100",
  PER_1000 = "PER_1000",
  PER_10000 = "PER_10000",
  RATE = "RATE",
  PERCENTILE = "PERCENTILE",
  MEDIAN_BUCKETED = "MEDIAN_BUCKETED",
  LOG_SCALED = "LOG_SCALED",
}
