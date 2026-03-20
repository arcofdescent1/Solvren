/**
 * Phase 2 — Confidence bands for simulation output.
 */
export enum SimulationConfidenceBand {
  VERY_HIGH = "VERY_HIGH", // 90-100
  HIGH = "HIGH",           // 75-89
  MODERATE = "MODERATE",   // 50-74
  LOW = "LOW",             // 25-49
  VERY_LOW = "VERY_LOW",   // 0-24
}

export function scoreToBand(score: number): SimulationConfidenceBand {
  if (score >= 90) return SimulationConfidenceBand.VERY_HIGH;
  if (score >= 75) return SimulationConfidenceBand.HIGH;
  if (score >= 50) return SimulationConfidenceBand.MODERATE;
  if (score >= 25) return SimulationConfidenceBand.LOW;
  return SimulationConfidenceBand.VERY_LOW;
}
