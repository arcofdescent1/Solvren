/**
 * Phase 6 — Benchmark normalization service (§10).
 */
import { BenchmarkNormalizationMethod } from "../domain/normalization-method";

export function normalizeValue(
  raw: number,
  method: BenchmarkNormalizationMethod,
  context?: { denominator?: number }
): number {
  switch (method) {
    case BenchmarkNormalizationMethod.NONE:
      return raw;
    case BenchmarkNormalizationMethod.PER_100:
      return context?.denominator ? (raw / context.denominator) * 100 : raw;
    case BenchmarkNormalizationMethod.PER_1000:
      return context?.denominator ? (raw / context.denominator) * 1000 : raw;
    case BenchmarkNormalizationMethod.PER_10000:
      return context?.denominator ? (raw / context.denominator) * 10000 : raw;
    case BenchmarkNormalizationMethod.RATE:
      return Math.min(1, Math.max(0, raw));
    case BenchmarkNormalizationMethod.PERCENTILE:
      return Math.min(100, Math.max(0, raw));
    case BenchmarkNormalizationMethod.MEDIAN_BUCKETED:
      return raw;
    case BenchmarkNormalizationMethod.LOG_SCALED:
      return raw <= 0 ? 0 : Math.log10(raw + 1);
    default:
      return raw;
  }
}
