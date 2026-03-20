/**
 * Phase 5 — Model RL2: Past-due invoice high value (§14.1).
 */
import type { IImpactModel } from "../base/impact-model.interface";
import type { ImpactModelContext } from "../base/impact-model-context";
import type { ImpactModelResult } from "../base/impact-model-result";

const MODEL_KEY = "revenue.invoice_past_due_high_value";
const VERSION = "1.0";

export class InvoicePastDueHighValueImpactModel implements IImpactModel {
  readonly modelKey = MODEL_KEY;
  readonly modelVersion = VERSION;

  async evaluate(ctx: ImpactModelContext): Promise<ImpactModelResult> {
    const timeline = (ctx.evidenceBundle.timeline ?? []) as Array<{ event: string; detail?: string }>;
    let amount = 0;

    for (const t of timeline) {
      if (t.detail && typeof t.detail === "string" && t.detail.includes("$")) {
        const m = t.detail.match(/\$?([\d,]+(?:\.\d{2})?)/);
        if (m) amount = Math.max(amount, parseFloat(m[1].replace(/,/g, "")) || 0);
      }
    }
    for (const sig of ctx.signals) {
      const measures = (sig.measures_json ?? {}) as Record<string, number>;
      const amt = measures.amount_due ?? measures.amount;
      if (amt != null && amt > amount) amount = amt;
    }

    if (amount <= 0) amount = 500;

    const recoveryRate = (ctx.assumptions.payment_recovery_rate as number) ?? 0.6;
    const ageDecay = 0.95;
    const revenueAtRisk = amount * (1 - recoveryRate) * ageDecay;
    const confidenceScore = amount > 0 ? 75 : 50;

    return {
      assessmentStatus: "estimated",
      directRealizedLossAmount: null,
      revenueAtRiskAmount: Math.round(revenueAtRisk * 100) / 100,
      avoidedLossAmount: null,
      recoveredValueAmount: null,
      operationalCostAmount: 15,
      affectedCustomerCount: 1,
      affectedRecordCount: 1,
      confidenceScore,
      impactScore: 0,
      inputsSnapshot: { amount, recoveryRate },
      assumptionsSnapshot: { payment_recovery_rate: recoveryRate },
      calculationBreakdown: {
        formula: "revenue_at_risk = amount * (1 - payment_recovery_rate) * age_decay",
        amount,
        recoveryRate,
        revenueAtRisk,
      },
      confidenceExplanation: {
        reason: amount > 0 ? "Invoice amount from evidence; age decay applied" : "Using default estimate",
      },
    };
  }
}
