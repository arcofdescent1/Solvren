/**
 * Phase 5 — Model CR1: Revenue-impacting change missing approval (§14.4).
 */
import type { IImpactModel } from "../base/impact-model.interface";
import type { ImpactModelContext } from "../base/impact-model-context";
import type { ImpactModelResult } from "../base/impact-model-result";

const MODEL_KEY = "change.revenue_change_missing_approval";
const VERSION = "1.0";

export class RevenueChangeMissingApprovalImpactModel implements IImpactModel {
  readonly modelKey = MODEL_KEY;
  readonly modelVersion = VERSION;

  async evaluate(ctx: ImpactModelContext): Promise<ImpactModelResult> {
    const surfaceShare = (ctx.assumptions.critical_surface_revenue_share as number) ?? 0.2;
    const riskMultiplier = 0.15;
    const baselineRisk = 50000;
    const revenueAtRisk = baselineRisk * surfaceShare * riskMultiplier;

    return {
      assessmentStatus: "estimated",
      directRealizedLossAmount: null,
      revenueAtRiskAmount: Math.round(revenueAtRisk * 100) / 100,
      avoidedLossAmount: null,
      recoveredValueAmount: null,
      operationalCostAmount: 30,
      affectedCustomerCount: 0,
      affectedRecordCount: 1,
      confidenceScore: 55,
      impactScore: 0,
      inputsSnapshot: {},
      assumptionsSnapshot: { critical_surface_revenue_share: surfaceShare },
      calculationBreakdown: { formula: "revenue_at_risk = baseline * surface_share * risk_multiplier", revenueAtRisk },
      confidenceExplanation: { reason: "Preventive estimate for unapproved change" },
    };
  }
}
