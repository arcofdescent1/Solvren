/**
 * Phase 5 — Model CR3: Change followed by incident (§14.4).
 */
import type { IImpactModel } from "../base/impact-model.interface";
import type { ImpactModelContext } from "../base/impact-model-context";
import type { ImpactModelResult } from "../base/impact-model-result";

const MODEL_KEY = "change.change_followed_by_incident";
const VERSION = "1.0";

export class ChangeFollowedByIncidentImpactModel implements IImpactModel {
  readonly modelKey = MODEL_KEY;
  readonly modelVersion = VERSION;

  async evaluate(ctx: ImpactModelContext): Promise<ImpactModelResult> {
    const surfaceShare = (ctx.assumptions.critical_surface_revenue_share as number) ?? 0.2;
    const baselinePerIncident = 10000;
    const directLoss = baselinePerIncident * surfaceShare;
    const revenueAtRisk = directLoss * 0.5;

    return {
      assessmentStatus: "estimated",
      directRealizedLossAmount: Math.round(directLoss * 100) / 100,
      revenueAtRiskAmount: Math.round(revenueAtRisk * 100) / 100,
      avoidedLossAmount: null,
      recoveredValueAmount: null,
      operationalCostAmount: 50,
      affectedCustomerCount: 0,
      affectedRecordCount: 1,
      confidenceScore: 60,
      impactScore: 0,
      inputsSnapshot: {},
      assumptionsSnapshot: { critical_surface_revenue_share: surfaceShare },
      calculationBreakdown: { formula: "direct_loss = baseline * surface_share; revenue_at_risk = ongoing_impact" },
      confidenceExplanation: { reason: "Incident severity and surface share" },
    };
  }
}
