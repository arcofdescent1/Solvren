/** Compact currency e.g. $120K/month */
export function formatRevenueAtRisk(
  amount: number | null | undefined,
  period: "MONTHLY" | "ONE_TIME"
): string | null {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return null;
  const abs = Math.abs(amount);
  let body: string;
  if (abs >= 1_000_000) body = `$${(abs / 1_000_000).toFixed(1)}M`;
  else if (abs >= 1000) body = `$${(abs / 1000).toFixed(abs >= 100_000 ? 0 : 1)}K`;
  else body = `$${Math.round(abs).toLocaleString()}`;
  const suffix = period === "MONTHLY" ? "/month" : " one-time";
  return `${body}${suffix}`;
}

export function formatCustomersAffected(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  if (n < 1000) return String(Math.round(n));
  return `~${(n / 1000).toFixed(1)}K`.replace(".0K", "K");
}

export function truncateList(items: string[], maxVisible: number): { visible: string[]; more: number } {
  const visible = items.slice(0, maxVisible);
  const more = Math.max(0, items.length - maxVisible);
  return { visible, more };
}

const DOMAIN_TO_DEPT: Record<string, string> = {
  REVENUE: "Finance",
  PRICING: "Sales",
  BILLING: "Finance",
  PAYMENTS: "Finance",
  SUBSCRIPTIONS: "Finance",
  CHECKOUT: "Operations",
  TAX: "Finance",
  PROMOTIONS: "Marketing",
  INVOICING: "Finance",
  ENTITLEMENTS: "Engineering",
  OTHER: "Operations",
};

export function departmentsFromDomain(domain: string | null | undefined): string[] {
  const d = String(domain ?? "OTHER").toUpperCase();
  const dept = DOMAIN_TO_DEPT[d] ?? "Operations";
  const set = new Set<string>(["Engineering", dept]);
  return [...set];
}

export function systemsFromSurface(surface: string | null | undefined): string[] {
  const s = String(surface ?? "Revenue systems")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return [s, "Connected revenue stack"].filter((x, i, a) => a.indexOf(x) === i).slice(0, 3);
}
