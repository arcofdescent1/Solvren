/**
 * Phase 5 — Model CR4: Unsafe change concentration (§14.4).
 */
import type { IImpactModel } from "../base/impact-model.interface";
import type { ImpactModelContext } from "../base/impact-model-context";
import type { ImpactModelResult } from "../base/impact-model-result";

const MODEL_KEY = "change.unsafe_change_concentration";
const VERSION = "1.0";

export class UnsafeChangeConcentrationImpactModel implements IImpactModel {
  readonly modelKey = MODEL_KEY;
  readonly modelVersion = VERSION;

  async evaluate(ctx: ImpactModelContext): Promise<ImpactModelResult> {
    const count = Math.max(ctx.signals.length, 1);
    const surfaceShare = (ctx.assumptions.critical_surface_revenue_share as number) ?? 0.2;
    const failureRate = 0.05;
    const baselinePerChange = 5000;

    const revenueAtRisk = count * baselinePerChange * surfaceShare * failureRate;
    const opCost = count * 15;

    return {
      assessmentStatus: "estimated",
      directRealizedLossAmount: null,
      revenueAtRiskAmount: Math.round(revenueAtRisk * 100) / 100,
      avoidedLossAmount: null,
      recoveredValueAmount: null,
      operationalCostAmount: Math.round(opCost * 100) / 100,
      affectedCustomerCount: 0,
      affectedRecordCount: count,
      confidenceScore: 45,
      impactScore: 0,
      inputsSnapshot: { count },
      assumptionsSnapshot: { critical_surface_revenue_share: surfaceShare },
      calculationBreakdown: { formula: "revenue_at_risk = count * baseline * surface_share * failure_rate" },
      confidenceExplanation: { reason: "Compounded risk from concentrated unsafe changes" },
    };
  }
}
