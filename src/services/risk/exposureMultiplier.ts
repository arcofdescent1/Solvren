export type RevenueSurface =
  | "PRICING"
  | "BILLING"
  | "PAYMENTS"
  | "SUBSCRIPTION"
  | "SUBSCRIPTIONS"
  | "PLAN_LOGIC"
  | "ENTITLEMENTS"
  | "CHECKOUT"
  | "TAX"
  | "PROMOTIONS"
  | "INVOICING"
  | "OTHER";

const SURFACE_WEIGHT: Record<string, number> = {
  PRICING: 1.25,
  BILLING: 1.25,
  PAYMENTS: 1.35,
  SUBSCRIPTION: 1.3,
  SUBSCRIPTIONS: 1.3,
  PLAN_LOGIC: 1.25,
  ENTITLEMENTS: 1.2,
  CHECKOUT: 1.4,
  TAX: 1.3,
  PROMOTIONS: 1.15,
  INVOICING: 1.15,
  OTHER: 1.0,
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** Deterministic exposure multiplier with DB-overridable surface weight. */
export function exposureMultiplierLocal(args: {
  revenueSurface?: RevenueSurface | string | null;
  surfaceWeight?: number | null;
  estimatedMrrAffected?: number | null;
  percentCustomerBaseAffected?: number | null;
}) {
  const surface = String(args.revenueSurface ?? "SUBSCRIPTION").toUpperCase();
  const surfaceWeight = Number(args.surfaceWeight ?? SURFACE_WEIGHT[surface] ?? 1.2);

  const mrr = Math.max(0, Number(args.estimatedMrrAffected ?? 0));
  const pct = clamp(Number(args.percentCustomerBaseAffected ?? 0), 0, 100);

  // mrr=0 => 1.0, mrr=2k => ~1.8, mrr=10k => ~2.3, mrr=50k => ~2.7, mrr=200k => ~3.0
  const mrrFactor = 1 + clamp(Math.log10(1 + mrr) / 2.5, 0, 2.0);
  // 0% => 1.0, 1% => 1.1, 10% => 1.32, 50% => 1.71, 100% => 2.0
  const pctFactor = 1 + clamp(Math.sqrt(pct) / 10, 0, 1.0);

  const multiplier = clamp(surfaceWeight * mrrFactor * pctFactor, 1, 8);

  return {
    multiplier,
    components: {
      surface,
      surfaceWeight,
      mrrFactor,
      pctFactor,
      mrr,
      pct,
    } as { surface: string; surfaceWeight: number; mrrFactor: number; pctFactor: number; mrr: number; pct: number },
  };
}

export function applyExposure(args: {
  baseRiskScore: number;
  revenueSurface?: RevenueSurface | string | null;
  surfaceWeight?: number | null;
  estimatedMrrAffected?: number | null;
  percentCustomerBaseAffected?: number | null;
}) {
  const { multiplier, components } = exposureMultiplierLocal(args);
  return {
    exposureMultiplier: multiplier,
    revenueRiskScore: args.baseRiskScore * multiplier,
    exposureComponents: components,
  };
}

export function exposureMultiplier(args: {
  revenueSurface?: RevenueSurface | string | null;
  estimatedMrrAffected?: number | null;
  percentCustomerBaseAffected?: number | null;
}) {
  return exposureMultiplierLocal(args);
}

export function exposureScore(args: {
  baseRiskScore: number;
  revenueSurface?: RevenueSurface | string | null;
  estimatedMrrAffected?: number | null;
  percentCustomerBaseAffected?: number | null;
}) {
  const r = applyExposure(args);
  return {
    exposureScore: r.revenueRiskScore,
    multiplier: r.exposureMultiplier,
    components: r.exposureComponents,
  };
}
