/**
 * Phase 5 — Model FP1: Qualified lead unworked (§14.2).
 */
import type { IImpactModel } from "../base/impact-model.interface";
import type { ImpactModelContext } from "../base/impact-model-context";
import type { ImpactModelResult } from "../base/impact-model-result";

const MODEL_KEY = "funnel.qualified_lead_unworked";
const VERSION = "1.0";

export class QualifiedLeadUnworkedImpactModel implements IImpactModel {
  readonly modelKey = MODEL_KEY;
  readonly modelVersion = VERSION;

  async evaluate(ctx: ImpactModelContext): Promise<ImpactModelResult> {
    const mqlRate = (ctx.assumptions.mql_to_opportunity_rate as number) ?? 0.15;
    const closeRate = (ctx.assumptions.opportunity_to_close_rate as number) ?? 0.25;
    const dealSize = (ctx.assumptions.avg_deal_size as number) ?? 25000;
    const decay = (ctx.assumptions.lead_response_decay_factor as number) ?? 0.1;

    const timeline = (ctx.evidenceBundle.timeline ?? []) as Array<{ event: string; detail?: string }>;
    const tc = (ctx.evidenceBundle.thresholds_crossed ?? []) as Array<{ value?: number }>;
    const hoursSince = (tc[0]?.value as number) ?? 24;
    const decayFactor = Math.max(0.3, 1 - hoursSince * decay * 0.01);

    const expectedValue = dealSize * mqlRate * closeRate * decayFactor;

    return {
      assessmentStatus: "estimated",
      directRealizedLossAmount: null,
      revenueAtRiskAmount: Math.round(expectedValue * 100) / 100,
      avoidedLossAmount: null,
      recoveredValueAmount: null,
      operationalCostAmount: 10,
      affectedCustomerCount: 1,
      affectedRecordCount: 1,
      confidenceScore: 55,
      impactScore: 0,
      inputsSnapshot: { hoursSince, decayFactor },
      assumptionsSnapshot: { mql_to_opportunity_rate: mqlRate, opportunity_to_close_rate: closeRate, avg_deal_size: dealSize },
      calculationBreakdown: {
        formula: "revenue_at_risk = avg_deal_size * mql_rate * close_rate * decay_factor",
        expectedValue,
      },
      confidenceExplanation: { reason: "Pipeline estimate from conversion assumptions" },
    };
  }
}
