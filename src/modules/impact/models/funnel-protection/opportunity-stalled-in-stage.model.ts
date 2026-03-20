/**
 * Phase 5 — Model FP2: Opportunity stalled in stage (§14.2).
 */
import type { IImpactModel } from "../base/impact-model.interface";
import type { ImpactModelContext } from "../base/impact-model-context";
import type { ImpactModelResult } from "../base/impact-model-result";

const MODEL_KEY = "funnel.opportunity_stalled_in_stage";
const VERSION = "1.0";

export class OpportunityStalledInStageImpactModel implements IImpactModel {
  readonly modelKey = MODEL_KEY;
  readonly modelVersion = VERSION;

  async evaluate(ctx: ImpactModelContext): Promise<ImpactModelResult> {
    let amount = 0;
    const timeline = (ctx.evidenceBundle.timeline ?? []) as Array<{ detail?: string }>;
    for (const t of timeline) {
      if (t.detail && typeof t.detail === "string" && t.detail.includes("$")) {
        const m = t.detail.match(/\$?([\d,]+(?:\.\d{2})?)/);
        if (m) amount = Math.max(amount, parseFloat(m[1].replace(/,/g, "")) || 0);
      }
    }
    for (const sig of ctx.signals) {
      const m = (sig.measures_json ?? {}) as Record<string, number>;
      if (m.amount != null && m.amount > amount) amount = m.amount;
    }
    if (amount <= 0) amount = (ctx.assumptions.avg_deal_size as number) ?? 25000;

    const closeRate = (ctx.assumptions.opportunity_to_close_rate as number) ?? 0.25;
    const tc = (ctx.evidenceBundle.thresholds_crossed ?? []) as Array<{ value?: number; limit?: number }>;
    const ageDays = (tc[0]?.value as number) ?? 14;
    const slaDays = (tc[0]?.limit as number) ?? 14;
    const decayFactor = Math.max(0.2, 1 - (ageDays - slaDays) * 0.02);
    const revenueAtRisk = amount * closeRate * decayFactor;

    return {
      assessmentStatus: "estimated",
      directRealizedLossAmount: null,
      revenueAtRiskAmount: Math.round(revenueAtRisk * 100) / 100,
      avoidedLossAmount: null,
      recoveredValueAmount: null,
      operationalCostAmount: 15,
      affectedCustomerCount: 1,
      affectedRecordCount: 1,
      confidenceScore: amount > 0 ? 70 : 50,
      impactScore: 0,
      inputsSnapshot: { amount, ageDays, decayFactor },
      assumptionsSnapshot: { opportunity_to_close_rate: closeRate },
      calculationBreakdown: { formula: "revenue_at_risk = amount * close_rate * stage_decay", revenueAtRisk },
      confidenceExplanation: { reason: amount > 0 ? "Opportunity amount from evidence" : "Using default deal size" },
    };
  }
}
