/**
 * Phase 9 — Confidence bands (§7).
 */
export enum AutonomyConfidenceBand {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
}

export const DEFAULT_CONFIDENCE_THRESHOLDS = {
  LOW_MAX: 49,
  MEDIUM_MAX: 79,
  HIGH_MAX: 100,
} as const;

export function scoreToBand(
  score: number,
  thresholds = DEFAULT_CONFIDENCE_THRESHOLDS
): AutonomyConfidenceBand {
  if (score <= thresholds.LOW_MAX) return AutonomyConfidenceBand.LOW;
  if (score <= thresholds.MEDIUM_MAX) return AutonomyConfidenceBand.MEDIUM;
  return AutonomyConfidenceBand.HIGH;
}
