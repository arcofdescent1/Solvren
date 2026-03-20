/**
 * Phase 5 — Model DI2: Opportunity missing source attribution (§14.3).
 */
import type { IImpactModel } from "../base/impact-model.interface";
import type { ImpactModelContext } from "../base/impact-model-context";
import type { ImpactModelResult } from "../base/impact-model-result";

const MODEL_KEY = "data.opportunity_missing_source_attribution";
const VERSION = "1.0";

export class OpportunityMissingSourceAttributionImpactModel implements IImpactModel {
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
    const repairHours = 0.5;

    return {
      assessmentStatus: "estimated",
      directRealizedLossAmount: null,
      revenueAtRiskAmount: amount * 0.05,
      avoidedLossAmount: null,
      recoveredValueAmount: null,
      operationalCostAmount: Math.round(laborRate * repairHours * 100) / 100,
      affectedCustomerCount: 1,
      affectedRecordCount: 1,
      confidenceScore: 45,
      impactScore: 0,
      inputsSnapshot: { amount },
      assumptionsSnapshot: { loaded_labor_cost_per_hour: laborRate },
      calculationBreakdown: { formula: "op_cost = repair_hours * labor_rate; revenue_at_risk = amount * routing_impact" },
      confidenceExplanation: { reason: "Attribution impact on routing and reporting" },
    };
  }
}
