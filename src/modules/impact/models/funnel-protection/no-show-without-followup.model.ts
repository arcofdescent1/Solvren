/**
 * Phase 5 — Model FP4: No-show without follow-up (§14.2).
 */
import type { IImpactModel } from "../base/impact-model.interface";
import type { ImpactModelContext } from "../base/impact-model-context";
import type { ImpactModelResult } from "../base/impact-model-result";

const MODEL_KEY = "funnel.no_show_without_followup";
const VERSION = "1.0";

export class NoShowWithoutFollowupImpactModel implements IImpactModel {
  readonly modelKey = MODEL_KEY;
  readonly modelVersion = VERSION;

  async evaluate(ctx: ImpactModelContext): Promise<ImpactModelResult> {
    const meetingRate = (ctx.assumptions.meeting_to_opportunity_rate as number) ?? 0.35;
    const closeRate = (ctx.assumptions.opportunity_to_close_rate as number) ?? 0.25;
    const dealSize = (ctx.assumptions.avg_deal_size as number) ?? 25000;
    const recoveryRate = 0.4;

    const expectedValue = dealSize * meetingRate * closeRate * (1 - recoveryRate);

    return {
      assessmentStatus: "estimated",
      directRealizedLossAmount: null,
      revenueAtRiskAmount: Math.round(expectedValue * 100) / 100,
      avoidedLossAmount: null,
      recoveredValueAmount: null,
      operationalCostAmount: 12,
      affectedCustomerCount: 1,
      affectedRecordCount: 1,
      confidenceScore: 48,
      impactScore: 0,
      inputsSnapshot: {},
      assumptionsSnapshot: { meeting_to_opportunity_rate: meetingRate, opportunity_to_close_rate: closeRate, avg_deal_size: dealSize },
      calculationBreakdown: { formula: "revenue_at_risk = deal_size * meeting_rate * close_rate * (1 - recovery_rate)", expectedValue },
      confidenceExplanation: { reason: "Estimated lost pipeline from no-show without reschedule" },
    };
  }
}
