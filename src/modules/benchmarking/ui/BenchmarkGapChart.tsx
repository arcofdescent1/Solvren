"use client";

import type { BenchmarkResult } from "../domain/benchmark-result";

export type BenchmarkGapChartProps = {
  result: BenchmarkResult;
};

/**
 * Simple gap visualization: customer marker vs cohort median and IQR.
 * Does not expose full distribution (privacy).
 */
export function BenchmarkGapChart({ result }: BenchmarkGapChartProps) {
  if (!result.safeToDisplay || result.cohortP25 == null || result.cohortP75 == null) {
    return null;
  }

  const p25 = result.cohortP25;
  const p75 = result.cohortP75;
  const median = result.cohortMedian ?? (p25 + p75) / 2;
  const customer = result.customerValue;

  const span = p75 - p25 || 1;
  const min = Math.min(p25 - span * 0.5, customer ?? median);
  const max = Math.max(p75 + span * 0.5, customer ?? median);
  const range = max - min || 1;

  const toPos = (v: number) => ((v - min) / range) * 100;

  return (
    <div className="relative h-8 w-full rounded bg-[var(--bg-surface-2)]">
      <div
        className="absolute top-0 h-full rounded bg-[var(--primary)]/20"
        style={{
          left: `${toPos(p25)}%`,
          width: `${toPos(p75) - toPos(p25)}%`,
        }}
      />
      <div
        className="absolute top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-[var(--primary)]"
        style={{ left: `${toPos(median)}%` }}
        title="Cohort median"
      />
      {customer != null && (
        <div
          className="absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-[var(--primary)] bg-[var(--bg-surface)]"
          style={{ left: `${toPos(customer)}%` }}
          title="Your value"
        />
      )}
    </div>
  );
}
