/**
 * Phase 2 — Computes confidence score and band for simulation output.
 */
import { SimulationConfidenceBand, scoreToBand } from "../domain";

export type ConfidenceInputs = {
  snapshotCompleteness: number;
  issueCoverage: number;
  signalQuality: number;
  entityLinkageQuality: number;
  directMonetaryDataRatio: number;
  assumptionsQuality: number;
  policyResolutionCompleteness: number;
};

export type ConfidenceOutput = {
  score: number;
  band: SimulationConfidenceBand;
  interval: { low: number; high: number };
  reasons: string[];
};

export function computeConfidence(inputs: Partial<ConfidenceInputs>): ConfidenceOutput {
  const reasons: string[] = [];
  let score = 80;

  const snap = inputs.snapshotCompleteness ?? 1;
  if (snap < 0.9) {
    score -= 15;
    reasons.push("Snapshot incomplete");
  } else {
    reasons.push("Snapshot complete");
  }

  const cov = inputs.issueCoverage ?? 1;
  if (cov < 0.8) {
    score -= 10;
    reasons.push(`Issue coverage ${Math.round(cov * 100)}%`);
  } else {
    reasons.push(`${Math.round(cov * 100)}% issue coverage`);
  }

  const sig = inputs.signalQuality ?? 0.8;
  if (sig < 0.7) {
    score -= 8;
    reasons.push("Signal quality reduced");
  }

  const entity = inputs.entityLinkageQuality ?? 0.8;
  if (entity < 0.7) {
    score -= 5;
    reasons.push("Entity linkage gaps");
  }

  const monetary = inputs.directMonetaryDataRatio ?? 0.5;
  if (monetary > 0.8) {
    reasons.push("High proportion of direct monetary data");
  } else if (monetary < 0.3) {
    score -= 10;
    reasons.push("Mostly inferred values");
  }

  const policy = inputs.policyResolutionCompleteness ?? 1;
  if (policy < 1) {
    score -= 5;
    reasons.push("Policy set partially resolved");
  } else {
    reasons.push("Policy set fully resolved");
  }

  score = Math.max(0, Math.min(100, score));
  const band = scoreToBand(score);
  const intervalLow = Math.max(0.5, score / 100 - 0.1);
  const intervalHigh = Math.min(1, score / 100 + 0.1);

  return {
    score,
    band,
    interval: { low: intervalLow, high: intervalHigh },
    reasons,
  };
}
