"use client";

import { Card, CardBody } from "@/ui";
import { BenchmarkConfidenceBadge } from "./BenchmarkConfidenceBadge";
import type { BenchmarkResult } from "../domain/benchmark-result";

export type BenchmarkCardProps = {
  result: BenchmarkResult;
};

export function BenchmarkCard({ result }: BenchmarkCardProps) {
  if (!result.safeToDisplay) {
    return (
      <Card>
        <CardBody>
          <h3 className="text-sm font-semibold text-[var(--text)]">{result.displayName}</h3>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Not enough data for benchmark yet.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text)]">{result.displayName}</h3>
          <BenchmarkConfidenceBadge band={result.confidenceBand} />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {result.customerValue != null && (
            <div>
              <p className="text-[var(--text-muted)]">Your value</p>
              <p className="font-mono font-medium">{result.customerValue.toFixed(2)}</p>
            </div>
          )}
          {result.cohortMedian != null && (
            <div>
              <p className="text-[var(--text-muted)]">Cohort median</p>
              <p className="font-mono font-medium">{result.cohortMedian.toFixed(2)}</p>
            </div>
          )}
          {result.percentileRank != null && (
            <div>
              <p className="text-[var(--text-muted)]">Percentile</p>
              <p className="font-mono font-medium">{result.percentileRank}th</p>
            </div>
          )}
        </div>
        <p className="mt-3 text-xs text-[var(--text-muted)]">{result.explanationText}</p>
      </CardBody>
    </Card>
  );
}
