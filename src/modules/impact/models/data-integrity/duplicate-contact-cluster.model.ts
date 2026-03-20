/**
 * Phase 5 — Model DI1: Duplicate contact cluster (§14.3).
 */
import type { IImpactModel } from "../base/impact-model.interface";
import type { ImpactModelContext } from "../base/impact-model-context";
import type { ImpactModelResult } from "../base/impact-model-result";

const MODEL_KEY = "data.duplicate_contact_cluster";
const VERSION = "1.0";

export class DuplicateContactClusterImpactModel implements IImpactModel {
  readonly modelKey = MODEL_KEY;
  readonly modelVersion = VERSION;

  async evaluate(ctx: ImpactModelContext): Promise<ImpactModelResult> {
    const tc = (ctx.evidenceBundle.thresholds_crossed ?? []) as Array<{ value?: number }>;
    const count = (tc[0]?.value as number) ?? ctx.signals.length ?? 2;
    const minutesPerRecord = (ctx.assumptions.duplicate_cleanup_minutes_per_record as number) ?? 15;
    const laborRate = (ctx.assumptions.loaded_labor_cost_per_hour as number) ?? 75;

    const totalMinutes = count * minutesPerRecord;
    const operationalCost = (totalMinutes / 60) * laborRate;

    return {
      assessmentStatus: "estimated",
      directRealizedLossAmount: null,
      revenueAtRiskAmount: null,
      avoidedLossAmount: null,
      recoveredValueAmount: null,
      operationalCostAmount: Math.round(operationalCost * 100) / 100,
      affectedCustomerCount: count,
      affectedRecordCount: count,
      confidenceScore: 75,
      impactScore: 0,
      inputsSnapshot: { count, minutesPerRecord },
      assumptionsSnapshot: { duplicate_cleanup_minutes_per_record: minutesPerRecord, loaded_labor_cost_per_hour: laborRate },
      calculationBreakdown: { formula: "operational_cost = count * minutes_per_record * labor_rate / 60", operationalCost },
      confidenceExplanation: { reason: "Labor cost from cleanup time assumption" },
    };
  }
}
