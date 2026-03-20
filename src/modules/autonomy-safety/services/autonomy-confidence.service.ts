/**
 * Phase 9 — Autonomy confidence scoring (§8).
 */
import { AutonomyConfidenceBand, scoreToBand } from "../domain";

export type AutonomyConfidenceInputs = {
  signalQualityNorm?: number | null;
  issueConfidenceNorm?: number | null;
  impactConfidenceNorm?: number | null;
  decisionConfidenceNorm?: number | null;
  connectorHealthNorm?: number | null;
  historicalSuccessNorm?: number | null;
  verificationSuccessNorm?: number | null;
  rollbackPenaltyNorm?: number | null;
  partialFailurePenaltyNorm?: number | null;
  missingDataPenaltyNorm?: number | null;
};

export type AutonomyConfidenceResult = {
  score: number;
  band: AutonomyConfidenceBand;
  reasonCodes: string[];
  supportingMetrics: Record<string, number>;
};

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function computeAutonomyConfidence(
  inputs: AutonomyConfidenceInputs
): AutonomyConfidenceResult {
  const reasonCodes: string[] = [];
  const metrics: Record<string, number> = {};

  const s = inputs.signalQualityNorm ?? 70;
  const i = inputs.issueConfidenceNorm ?? 70;
  const imp = inputs.impactConfidenceNorm ?? 70;
  const d = inputs.decisionConfidenceNorm ?? 70;
  const c = inputs.connectorHealthNorm ?? 70;
  const h = inputs.historicalSuccessNorm ?? 70;
  const v = inputs.verificationSuccessNorm ?? 70;
  const rb = inputs.rollbackPenaltyNorm ?? 0;
  const pf = inputs.partialFailurePenaltyNorm ?? 0;
  const md = inputs.missingDataPenaltyNorm ?? 0;

  if (inputs.signalQualityNorm == null) reasonCodes.push("missing_required_inputs");
  if (inputs.connectorHealthNorm == null) reasonCodes.push("missing_required_inputs");

  const score = clamp(
    0.2 * s +
      0.15 * i +
      0.1 * imp +
      0.15 * d +
      0.15 * c +
      0.1 * h +
      0.05 * v -
      0.05 * rb -
      0.03 * pf -
      0.02 * md
  );

  metrics.signalQualityNorm = s;
  metrics.connectorHealthNorm = c;
  metrics.decisionConfidenceNorm = d;

  const band = scoreToBand(score);
  if (band === AutonomyConfidenceBand.LOW) reasonCodes.push("low_autonomy_confidence");
  if (band === AutonomyConfidenceBand.MEDIUM) reasonCodes.push("medium_autonomy_confidence");

  return {
    score,
    band,
    reasonCodes: [...new Set(reasonCodes)],
    supportingMetrics: metrics,
  };
}
