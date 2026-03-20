"use client";

import { Badge } from "@/ui";
import type { BenchmarkConfidenceBand } from "../domain/benchmark-confidence-band";

export type BenchmarkConfidenceBadgeProps = {
  band: BenchmarkConfidenceBand;
};

const BAND_LABELS: Record<BenchmarkConfidenceBand, string> = {
  VERY_HIGH: "Very High",
  HIGH: "High",
  MODERATE: "Moderate",
  LOW: "Low",
  VERY_LOW: "Very Low",
};

export function BenchmarkConfidenceBadge({ band }: BenchmarkConfidenceBadgeProps) {
  const label = BAND_LABELS[band] ?? band;
  const variant =
    band === "VERY_HIGH" || band === "HIGH"
      ? "default"
      : band === "MODERATE"
        ? "secondary"
        : "outline";
  return <Badge variant={variant}>{label}</Badge>;
}
