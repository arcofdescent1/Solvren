/**
 * Phase 5 — Model CR2: High-risk change missing evidence (§14.4).
 */
import type { IImpactModel } from "../base/impact-model.interface";
import type { ImpactModelContext } from "../base/impact-model-context";
import type { ImpactModelResult } from "../base/impact-model-result";

const MODEL_KEY = "change.high_risk_change_missing_evidence";
const VERSION = "1.0";

export class HighRiskChangeMissingEvidenceImpactModel implements IImpactModel {
  readonly modelKey = MODEL_KEY;
  readonly modelVersion = VERSION;

  async evaluate(ctx: ImpactModelContext): Promise<ImpactModelResult> {
    const surfaceShare = (ctx.assumptions.critical_surface_revenue_share as number) ?? 0.2;
    const baselineRisk = 30000;
    const revenueAtRisk = baselineRisk * surfaceShare * 0.2;

    return {
      assessmentStatus: "estimated",
      directRealizedLossAmount: null,
      revenueAtRiskAmount: Math.round(revenueAtRisk * 100) / 100,
      avoidedLossAmount: null,
      recoveredValueAmount: null,
      operationalCostAmount: 25,
      affectedCustomerCount: 0,
      affectedRecordCount: 1,
      confidenceScore: 48,
      impactScore: 0,
      inputsSnapshot: {},
      assumptionsSnapshot: { critical_surface_revenue_share: surfaceShare },
      calculationBreakdown: { formula: "revenue_at_risk = baseline * surface_share * evidence_gap_risk" },
      confidenceExplanation: { reason: "Governance gap prevention estimate" },
    };
  }
}
