// Phase 1A — Revenue Exposure Multiplier
export type RevenueSurface =
  | "PRICING"
  | "BILLING"
  | "PAYMENTS"
  | "SUBSCRIPTIONS"
  | "ENTITLEMENTS"
  | "CHECKOUT"
  | "TAX"
  | "PROMOTIONS"
  | "INVOICING"
  | "OTHER";

export type ExposureInputs = {
  estimatedMrrAffected?: number | null;
  percentCustomerBaseAffected?: number | null; // 0..100
  revenueSurface?: RevenueSurface | null;
};

// Opinionated surface weights (can become DB-config later)
const SURFACE_WEIGHT: Record<RevenueSurface, number> = {
  PRICING: 1.35,
  BILLING: 1.25,
  PAYMENTS: 1.35,
  SUBSCRIPTIONS: 1.25,
  ENTITLEMENTS: 1.15,
  CHECKOUT: 1.2,
  TAX: 1.1,
  PROMOTIONS: 1.1,
  INVOICING: 1.15,
  OTHER: 1.0,
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Returns:
 * - multiplier: 1.0+ that scales base risk
 * - normalizedExposure: 0..1 used for revenue-at-risk math (optional)
 * - explanation: for UI explainability
 */
export function computeRevenueExposureMultiplier(inputs: ExposureInputs) {
  const mrr = inputs.estimatedMrrAffected ?? null;
  const pct = inputs.percentCustomerBaseAffected ?? null;
  const surface = inputs.revenueSurface ?? null;

  const surfaceWeight = surface ? SURFACE_WEIGHT[surface] ?? 1.0 : 1.0;

  // Convert percent affected into factor: 0..1 then "impact curve"
  const pctNorm = pct == null ? null : clamp(pct, 0, 100) / 100;

  // MRR curve: log-ish growth
  const mrrFactor =
    mrr == null
      ? 1.0
      : 1.0 + clamp(Math.log10(1 + mrr / 1000), 0, 3) * 0.25; // max +0.75

  const pctFactor =
    pctNorm == null
      ? 1.0
      : 1.0 + clamp(Math.pow(pctNorm, 0.6), 0, 1) * 0.9; // max +0.9

  // Compose multiplier (floor 1.0)
  const multiplier = clamp(surfaceWeight * mrrFactor * pctFactor, 1.0, 3.5);

  // Normalized exposure (0..1) for revenue-at-risk
  const normalizedExposure = clamp(
    (pctNorm ?? 0) * 0.6 + (mrr == null ? 0 : clamp(mrr / 50000, 0, 1)) * 0.4,
    0,
    1
  );

  const explanation = {
    surface,
    surfaceWeight,
    mrr,
    mrrFactor,
    pct,
    pctFactor,
    multiplier,
    normalizedExposure,
  };

  return { multiplier, normalizedExposure, explanation };
}

export type RiskResult = {
  baseRiskScore: number;
  riskScore: number;
  riskBucket: string;
  learnedRiskFlag?: boolean;
  revenue: {
    exposureMultiplier: number;
    normalizedExposure: number;
    estimatedMrrAffected?: number | null;
    percentCustomerBaseAffected?: number | null;
    revenueSurface?: string | null;
    explanation: Record<string, unknown>;
  };
};

/**
 * Apply revenue exposure multiplier to base risk score.
 * Buckets should be based on the exposure-weighted riskScore, not the base.
 */
export function applyRevenueExposure(
  baseRiskScore: number,
  inputs: {
    estimatedMrrAffected?: number | null;
    percentCustomerBaseAffected?: number | null;
    revenueSurface?: string | null;
  }
): { riskScore: number; revenue: RiskResult["revenue"] } {
  const surface = inputs.revenueSurface as RevenueSurface | null | undefined;
  const { multiplier, normalizedExposure, explanation } =
    computeRevenueExposureMultiplier({
      estimatedMrrAffected: inputs.estimatedMrrAffected ?? null,
      percentCustomerBaseAffected: inputs.percentCustomerBaseAffected ?? null,
      revenueSurface: surface ?? null,
    });

  const riskScore = Math.max(0, Math.min(100, baseRiskScore * multiplier));

  return {
    riskScore,
    revenue: {
      exposureMultiplier: multiplier,
      normalizedExposure,
      estimatedMrrAffected: inputs.estimatedMrrAffected ?? null,
      percentCustomerBaseAffected: inputs.percentCustomerBaseAffected ?? null,
      revenueSurface: inputs.revenueSurface ?? null,
      explanation,
    },
  };
}
