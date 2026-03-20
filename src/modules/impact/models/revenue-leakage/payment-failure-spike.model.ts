/**
 * Phase 5 — Model RL4: Payment failure spike (§14.1).
 */
import type { IImpactModel } from "../base/impact-model.interface";
import type { ImpactModelContext } from "../base/impact-model-context";
import type { ImpactModelResult } from "../base/impact-model-result";

const MODEL_KEY = "revenue.payment_failure_spike";
const VERSION = "1.0";

export class PaymentFailureSpikeImpactModel implements IImpactModel {
  readonly modelKey = MODEL_KEY;
  readonly modelVersion = VERSION;

  async evaluate(ctx: ImpactModelContext): Promise<ImpactModelResult> {
    const evidence = ctx.evidenceBundle;
    const supporting = (evidence.supporting_metrics ?? {}) as Record<string, number>;
    const totalFailed = supporting.totalAmount ?? (evidence.total_failed_amount as number) ?? 0;
    const count = supporting.count ?? (evidence.failure_count as number) ?? (evidence.count as number) ?? 0;

    let amount = totalFailed;
    if (amount <= 0) {
      for (const sig of ctx.signals) {
        const measures = (sig.measures_json ?? {}) as Record<string, number>;
        amount += measures.amount ?? measures.amount_due ?? 0;
      }
    }
    const failCount = count > 0 ? count : ctx.signals.length || 1;
    if (amount <= 0) amount = failCount * 150;

    const recoveryRate = (ctx.assumptions.payment_recovery_rate as number) ?? 0.6;
    const revenueAtRisk = amount * (1 - recoveryRate);
    const opCost = failCount * 5;

    return {
      assessmentStatus: "estimated",
      directRealizedLossAmount: null,
      revenueAtRiskAmount: Math.round(revenueAtRisk * 100) / 100,
      avoidedLossAmount: null,
      recoveredValueAmount: null,
      operationalCostAmount: Math.round(opCost * 100) / 100,
      affectedCustomerCount: failCount,
      affectedRecordCount: failCount,
      confidenceScore: amount > 0 ? 65 : 45,
      impactScore: 0,
      inputsSnapshot: { amount, failCount, recoveryRate },
      assumptionsSnapshot: { payment_recovery_rate: recoveryRate },
      calculationBreakdown: {
        formula: "revenue_at_risk = total_failed_amount * (1 - payment_recovery_rate)",
        amount,
        failCount,
        revenueAtRisk,
      },
      confidenceExplanation: {
        reason: amount > 0 ? "Aggregate failure amount from evidence" : "Estimated from failure count",
      },
    };
  }
}
