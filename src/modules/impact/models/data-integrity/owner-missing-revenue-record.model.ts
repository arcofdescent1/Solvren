/**
 * Phase 5 — Model DI3: Owner missing on revenue-critical records (§14.3).
 */
import type { IImpactModel } from "../base/impact-model.interface";
import type { ImpactModelContext } from "../base/impact-model-context";
import type { ImpactModelResult } from "../base/impact-model-result";

const MODEL_KEY = "data.owner_missing_revenue_record";
const VERSION = "1.0";

export class OwnerMissingRevenueRecordImpactModel implements IImpactModel {
  readonly modelKey = MODEL_KEY;
  readonly modelVersion = VERSION;

  async evaluate(ctx: ImpactModelContext): Promise<ImpactModelResult> {
    let amount = 0;
    for (const sig of ctx.signals) {
      const m = (sig.measures_json ?? {}) as Record<string, number>;
      if (m.amount != null && m.amount > amount) amount = m.amount;
    }
    if (amount <= 0) amount = (ctx.assumptions.avg_deal_size as number) ?? 25000;

    const laborRate = (ctx.assumptions.loaded_labor_cost_per_hour as number) ?? 75;

    return {
      assessmentStatus: "estimated",
      directRealizedLossAmount: null,
      revenueAtRiskAmount: Math.round(amount * 0.1 * 100) / 100,
      avoidedLossAmount: null,
      recoveredValueAmount: null,
      operationalCostAmount: Math.round(laborRate * 0.25 * 100) / 100,
      affectedCustomerCount: 1,
      affectedRecordCount: 1,
      confidenceScore: 50,
      impactScore: 0,
      inputsSnapshot: { amount },
      assumptionsSnapshot: { loaded_labor_cost_per_hour: laborRate },
      calculationBreakdown: { formula: "revenue_at_risk = amount * triage_delay_risk; op_cost = triage_hours * labor_rate" },
      confidenceExplanation: { reason: "Unassigned pipeline at risk of delayed response" },
    };
  }
}
