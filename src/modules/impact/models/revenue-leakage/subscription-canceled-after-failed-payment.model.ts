/**
 * Phase 5 — Model RL3: Subscription canceled after payment distress (§14.1).
 */
import type { IImpactModel } from "../base/impact-model.interface";
import type { ImpactModelContext } from "../base/impact-model-context";
import type { ImpactModelResult } from "../base/impact-model-result";

const MODEL_KEY = "revenue.subscription_canceled_after_failed_payment";
const VERSION = "1.0";

export class SubscriptionCanceledAfterFailedPaymentImpactModel implements IImpactModel {
  readonly modelKey = MODEL_KEY;
  readonly modelVersion = VERSION;

  async evaluate(ctx: ImpactModelContext): Promise<ImpactModelResult> {
    const timeline = (ctx.evidenceBundle.timeline ?? []) as Array<{ event: string; detail?: string }>;
    let mrr = 0;
    let directLoss = 0;

    for (const t of timeline) {
      if (t.detail && typeof t.detail === "string") {
        const m = t.detail.match(/\$?([\d,]+(?:\.\d{2})?)/);
        if (m) {
          const v = parseFloat(m[1].replace(/,/g, "")) || 0;
          if (t.event === "subscription_canceled" || t.detail.toLowerCase().includes("mrr")) mrr = Math.max(mrr, v);
          else directLoss = Math.max(directLoss, v);
        }
      }
    }
    for (const sig of ctx.signals) {
      const measures = (sig.measures_json ?? {}) as Record<string, number>;
      if (measures.mrr != null && measures.mrr > mrr) mrr = measures.mrr;
      if (measures.amount != null && measures.amount > directLoss) directLoss = measures.amount;
    }

    if (mrr <= 0) mrr = 100;
    const ltvMultiplier = (ctx.assumptions.avg_ltv_multiplier as number) ?? 24;
    const revenueAtRisk = mrr * ltvMultiplier;
    const confidenceScore = mrr > 0 ? 70 : 50;

    return {
      assessmentStatus: "estimated",
      directRealizedLossAmount: directLoss > 0 ? Math.round(directLoss * 100) / 100 : null,
      revenueAtRiskAmount: Math.round(revenueAtRisk * 100) / 100,
      avoidedLossAmount: null,
      recoveredValueAmount: null,
      operationalCostAmount: 20,
      affectedCustomerCount: 1,
      affectedRecordCount: 1,
      confidenceScore,
      impactScore: 0,
      inputsSnapshot: { mrr, ltvMultiplier, directLoss },
      assumptionsSnapshot: { avg_ltv_multiplier: ltvMultiplier },
      calculationBreakdown: {
        formula: "revenue_at_risk = mrr * avg_ltv_multiplier",
        mrr,
        ltvMultiplier,
        revenueAtRisk,
      },
      confidenceExplanation: {
        reason: mrr > 0 ? "MRR/LTV-based estimate for churned subscription" : "Using default estimate",
      },
    };
  }
}
