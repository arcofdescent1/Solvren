/**
 * Phase 6 — Benchmark confidence bands (§12.2).
 */
export enum BenchmarkConfidenceBand {
  VERY_HIGH = "VERY_HIGH", // 90-100
  HIGH = "HIGH",           // 75-89
  MODERATE = "MODERATE",   // 50-74
  LOW = "LOW",             // 25-49
  VERY_LOW = "VERY_LOW",   // 0-24
}

export function scoreToBand(score: number): BenchmarkConfidenceBand {
  if (score >= 90) return BenchmarkConfidenceBand.VERY_HIGH;
  if (score >= 75) return BenchmarkConfidenceBand.HIGH;
  if (score >= 50) return BenchmarkConfidenceBand.MODERATE;
  if (score >= 25) return BenchmarkConfidenceBand.LOW;
  return BenchmarkConfidenceBand.VERY_LOW;
}
