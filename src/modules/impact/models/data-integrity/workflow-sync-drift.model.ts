/**
 * Phase 5 — Model DI4: Workflow sync drift detected (§14.3).
 */
import type { IImpactModel } from "../base/impact-model.interface";
import type { ImpactModelContext } from "../base/impact-model-context";
import type { ImpactModelResult } from "../base/impact-model-result";

const MODEL_KEY = "data.workflow_sync_drift_detected";
const VERSION = "1.0";

export class WorkflowSyncDriftImpactModel implements IImpactModel {
  readonly modelKey = MODEL_KEY;
  readonly modelVersion = VERSION;

  async evaluate(ctx: ImpactModelContext): Promise<ImpactModelResult> {
    const recordCount = Math.max(ctx.signals.length, 1);
    const minutesPerRecord = (ctx.assumptions.duplicate_cleanup_minutes_per_record as number) ?? 15;
    const laborRate = (ctx.assumptions.loaded_labor_cost_per_hour as number) ?? 75;
    const surfaceShare = (ctx.assumptions.critical_surface_revenue_share as number) ?? 0.2;

    const opCost = (recordCount * minutesPerRecord / 60) * laborRate;
    const revenueAtRisk = 5000 * surfaceShare;

    return {
      assessmentStatus: "estimated",
      directRealizedLossAmount: null,
      revenueAtRiskAmount: Math.round(revenueAtRisk * 100) / 100,
      avoidedLossAmount: null,
      recoveredValueAmount: null,
      operationalCostAmount: Math.round(opCost * 100) / 100,
      affectedCustomerCount: 0,
      affectedRecordCount: recordCount,
      confidenceScore: 45,
      impactScore: 0,
      inputsSnapshot: { recordCount },
      assumptionsSnapshot: { duplicate_cleanup_minutes_per_record: minutesPerRecord, loaded_labor_cost_per_hour: laborRate, critical_surface_revenue_share: surfaceShare },
      calculationBreakdown: { formula: "op_cost = records * minutes * labor / 60; revenue_at_risk = baseline * surface_share" },
      confidenceExplanation: { reason: "Sync drift cleanup and workflow impact" },
    };
  }
}
