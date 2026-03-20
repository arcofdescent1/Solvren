/**
 * Phase 5 — Impact score computation (§12).
 */
export function computeImpactScore(inputs: {
  directRealizedLoss: number | null;
  revenueAtRisk: number | null;
  operationalCost: number | null;
  affectedCustomerCount: number | null;
  confidenceScore: number;
}): number {
  const loss = (inputs.directRealizedLoss ?? 0) + (inputs.revenueAtRisk ?? 0) + (inputs.operationalCost ?? 0);
  const customerFactor = Math.min(10, Math.log10((inputs.affectedCustomerCount ?? 1) + 1) * 10);
  const magnitudeScore = Math.min(100, Math.log10(loss + 1) * 15 + customerFactor);
  const confidenceFactor = inputs.confidenceScore / 100;
  return Math.round(Math.min(100, magnitudeScore * (0.5 + 0.5 * confidenceFactor)));
}
