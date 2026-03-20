/**
 * Phase 5 — Impact breakdown for display.
 */
export type ImpactBreakdown = {
  directRealizedLoss: number | null;
  revenueAtRisk: number | null;
  avoidedLoss: number | null;
  recoveredValue: number | null;
  operationalCost: number | null;
  affectedCustomerCount: number | null;
  affectedRecordCount: number | null;
  confidenceScore: number;
  impactScore: number;
  confidenceBand: string;
  formulaExplanation?: string;
  keyInputs?: Array<{ label: string; value: string | number }>;
};
