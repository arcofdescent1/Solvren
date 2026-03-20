/**
 * Phase 5 — Model FP3: Meeting missing after qualification (§14.2).
 */
import type { IImpactModel } from "../base/impact-model.interface";
import type { ImpactModelContext } from "../base/impact-model-context";
import type { ImpactModelResult } from "../base/impact-model-result";

const MODEL_KEY = "funnel.meeting_missing_after_qualification";
const VERSION = "1.0";

export class MeetingMissingAfterQualificationImpactModel implements IImpactModel {
  readonly modelKey = MODEL_KEY;
  readonly modelVersion = VERSION;

  async evaluate(ctx: ImpactModelContext): Promise<ImpactModelResult> {
    const meetingRate = (ctx.assumptions.meeting_to_opportunity_rate as number) ?? 0.35;
    const closeRate = (ctx.assumptions.opportunity_to_close_rate as number) ?? 0.25;
    const dealSize = (ctx.assumptions.avg_deal_size as number) ?? 25000;
    const decay = (ctx.assumptions.lead_response_decay_factor as number) ?? 0.1;

    const tc = (ctx.evidenceBundle.thresholds_crossed ?? []) as Array<{ value?: number }>;
    const hoursSince = (tc[0]?.value as number) ?? 48;
    const decayFactor = Math.max(0.25, 1 - hoursSince * decay * 0.005);

    const expectedValue = dealSize * meetingRate * closeRate * decayFactor;

    return {
      assessmentStatus: "estimated",
      directRealizedLossAmount: null,
      revenueAtRiskAmount: Math.round(expectedValue * 100) / 100,
      avoidedLossAmount: null,
      recoveredValueAmount: null,
      operationalCostAmount: 8,
      affectedCustomerCount: 1,
      affectedRecordCount: 1,
      confidenceScore: 50,
      impactScore: 0,
      inputsSnapshot: { hoursSince, decayFactor },
      assumptionsSnapshot: { meeting_to_opportunity_rate: meetingRate, opportunity_to_close_rate: closeRate, avg_deal_size: dealSize },
      calculationBreakdown: { formula: "revenue_at_risk = avg_deal_size * meeting_rate * close_rate * decay", expectedValue },
      confidenceExplanation: { reason: "Expected pipeline from meeting conversion assumptions" },
    };
  }
}
