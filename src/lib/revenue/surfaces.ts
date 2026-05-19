export const REVENUE_SURFACES = [
  "PRICING",
  "BILLING",
  "PAYMENTS",
  "SUBSCRIPTIONS",
  "PLAN_LOGIC",
  "ENTITLEMENTS",
  "CHECKOUT",
  "TAX",
  "PROMOTIONS",
  "INVOICING",
  "OTHER",
] as const;

export type RevenueSurface = (typeof REVENUE_SURFACES)[number];

const LEGACY_REVENUE_SURFACE_ALIASES: Record<string, RevenueSurface> = {
  SUBSCRIPTION: "SUBSCRIPTIONS",
};

export function normalizeRevenueSurface(value: string | null | undefined): RevenueSurface | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  const normalized = LEGACY_REVENUE_SURFACE_ALIASES[upper] ?? upper;
  return REVENUE_SURFACES.includes(normalized as RevenueSurface) ? (normalized as RevenueSurface) : null;
}

export function formatRevenueSurface(value: string | null | undefined) {
  const normalized = normalizeRevenueSurface(value);
  if (!normalized) return "Unspecified";
  return normalized
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}
