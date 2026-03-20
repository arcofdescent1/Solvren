/**
 * Phase 5 — Feature normalization service (§12–13).
 * Computes normalized 0–100 feature values for scoring.
 */
import type { DecisionContext } from "../domain/decision-context";
import type { CandidateAction } from "../domain/candidate-action";
import type { FeatureBreakdown } from "../domain/feature-breakdown";
import type { ActionPerformanceStatRow } from "../repositories/action-performance-stats.repository";

export type NormalizationRules = {
  impactBands?: Array<[number, number | null, number]>;
  riskPenaltyMap?: Record<string, number>;
};

const DEFAULT_IMPACT_BANDS: Array<[number, number | null, number]> = [
  [0, 999, 10],
  [1000, 4999, 30],
  [5000, 19999, 55],
  [20000, 99999, 80],
  [100000, null, 100],
];

const DEFAULT_RISK_PENALTY_MAP: Record<string, number> = {
  low: 10,
  medium: 30,
  high: 60,
  critical: 90,
};

export function normalizeImpact(
  ctx: DecisionContext,
  rules?: NormalizationRules
): { value: number; usedFallback: boolean } {
  const bands = rules?.impactBands ?? DEFAULT_IMPACT_BANDS;
  if (ctx.impactScore != null && typeof ctx.impactScore === "number") {
    const v = Math.max(0, Math.min(100, ctx.impactScore));
    return { value: v, usedFallback: false };
  }
  const amount = ctx.impactAmount ?? 0;
  for (const [lo, hi, norm] of bands) {
    if (amount >= lo && (hi === null || amount <= hi)) return { value: norm, usedFallback: false };
  }
  return { value: bands[bands.length - 1]?.[2] ?? 10, usedFallback: true };
}

export function normalizeConfidence(ctx: DecisionContext): { value: number; usedFallback: boolean } {
  const c = ctx.confidenceScore;
  if (c == null) return { value: 50, usedFallback: true };
  const v = typeof c === "number" ? c : parseFloat(String(c));
  if (Number.isNaN(v)) return { value: 50, usedFallback: true };
  const norm = v <= 1 ? v * 100 : Math.max(0, Math.min(100, v));
  return { value: norm, usedFallback: false };
}

export function normalizeHistoricalSuccess(
  actionKey: string,
  stats: ActionPerformanceStatRow | null,
  _ctx: DecisionContext
): { value: number; usedFallback: boolean } {
  if (!stats || stats.sample_count < 1) return { value: 50, usedFallback: true };
  const rate = stats.success_count / stats.sample_count;
  const norm = Math.round(rate * 100);
  return { value: Math.max(0, Math.min(100, norm)), usedFallback: false };
}

export function normalizeUrgency(ctx: DecisionContext): { value: number; usedFallback: boolean } {
  const sevMap: Record<string, number> = {
    critical: 100,
    high: 80,
    medium: 50,
    low: 20,
  };
  const priMap: Record<string, number> = {
    P1: 95,
    P2: 70,
    P3: 45,
    P4: 20,
  };
  const sev = ctx.severity ? sevMap[ctx.severity] ?? 50 : 50;
  const pri = ctx.priorityBand ? priMap[ctx.priorityBand] ?? 50 : 50;
  const value = Math.round((sev + pri) / 2);
  return { value: Math.max(0, Math.min(100, value)), usedFallback: !ctx.severity && !ctx.priorityBand };
}

export function normalizePolicyPreference(_ctx: DecisionContext): { value: number; usedFallback: boolean } {
  return { value: 50, usedFallback: true };
}

export function normalizeStrategicBoost(_ctx: DecisionContext): { value: number; usedFallback: boolean } {
  return { value: 20, usedFallback: true };
}

export function normalizeRiskPenalty(
  action: CandidateAction,
  rules?: NormalizationRules
): { value: number; usedFallback: boolean } {
  const map = rules?.riskPenaltyMap ?? DEFAULT_RISK_PENALTY_MAP;
  const v = map[action.riskLevel] ?? map.medium ?? 30;
  return { value: v, usedFallback: false };
}

export function normalizeFrictionPenalty(approvalRequired: boolean): number {
  return approvalRequired ? 30 : 5;
}

export function normalizeCooldownPenalty(_actionKey: string, _ctx: DecisionContext): number {
  return 0;
}

export function computeFeatureBreakdown(
  ctx: DecisionContext,
  action: CandidateAction,
  stats: ActionPerformanceStatRow | null,
  approvalRequired: boolean,
  rules?: NormalizationRules
): FeatureBreakdown & { fallbackCodes: string[] } {
  const fallbackCodes: string[] = [];
  const impact = normalizeImpact(ctx, rules);
  if (impact.usedFallback) fallbackCodes.push("missing_data_fallback");
  const confidence = normalizeConfidence(ctx);
  if (confidence.usedFallback) fallbackCodes.push("missing_data_fallback");
  const historical = normalizeHistoricalSuccess(action.actionKey, stats, ctx);
  if (historical.usedFallback) fallbackCodes.push("historically_uncertain");
  const urgency = normalizeUrgency(ctx);
  if (urgency.usedFallback) fallbackCodes.push("missing_data_fallback");
  const policyPref = normalizePolicyPreference(ctx);
  const strategic = normalizeStrategicBoost(ctx);
  const risk = normalizeRiskPenalty(action, rules);
  const friction = normalizeFrictionPenalty(approvalRequired);
  const cooldown = normalizeCooldownPenalty(action.actionKey, ctx);

  return {
    impactNorm: impact.value,
    confidenceNorm: confidence.value,
    historicalSuccessNorm: historical.value,
    urgencyNorm: urgency.value,
    policyPreferenceNorm: policyPref.value,
    strategicBoostNorm: strategic.value,
    riskPenaltyNorm: risk.value,
    frictionPenaltyNorm: friction,
    cooldownPenaltyNorm: cooldown,
    fallbackCodes,
  };
}
