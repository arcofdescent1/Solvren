/**
 * Phase 5 — Impact model result (§9).
 */
export type ImpactModelResult = {
  assessmentStatus: "estimated" | "insufficient_data";
  directRealizedLossAmount: number | null;
  revenueAtRiskAmount: number | null;
  avoidedLossAmount: number | null;
  recoveredValueAmount: number | null;
  operationalCostAmount: number | null;
  affectedCustomerCount: number | null;
  affectedRecordCount: number | null;
  confidenceScore: number;
  impactScore: number;
  inputsSnapshot: Record<string, unknown>;
  assumptionsSnapshot: Record<string, unknown>;
  calculationBreakdown: Record<string, unknown>;
  confidenceExplanation: Record<string, unknown>;
};

export function createEmptyResult(reason: string): ImpactModelResult {
  return {
    assessmentStatus: "insufficient_data",
    directRealizedLossAmount: null,
    revenueAtRiskAmount: null,
    avoidedLossAmount: null,
    recoveredValueAmount: null,
    operationalCostAmount: null,
    affectedCustomerCount: null,
    affectedRecordCount: null,
    confidenceScore: 0,
    impactScore: 0,
    inputsSnapshot: {},
    assumptionsSnapshot: {},
    calculationBreakdown: { reason },
    confidenceExplanation: { reason },
  };
}
