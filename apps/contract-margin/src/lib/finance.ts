import Decimal from "decimal.js";

export type PortfolioRow = {
  customer_id: string; customer_name: string; customer_external_id: string;
  owner_email: string | null; renewal_on: string | null;
  revenue_usd: string; known_cost_usd: string; model_cost_usd: string;
  tool_cost_usd: string; human_cost_usd: string; other_cost_usd: string;
  completed_outcomes: number; failed_outcomes: number; usage_events: number;
  unknown_cost_events: number; target_margin_pct: string;
  latest_event_at: string | null; top_workflow: string | null;
};

export function usd(value: Decimal.Value) {
  const [whole, fraction] = new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2).split(".");
  const negative = whole.startsWith("-");
  const digits = negative ? whole.slice(1) : whole;
  return `${negative ? "-" : ""}$${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}

export function contribution(row: PortfolioRow) {
  return new Decimal(row.revenue_usd).minus(row.known_cost_usd);
}

export function contributionRate(row: PortfolioRow) {
  const revenue = new Decimal(row.revenue_usd);
  return revenue.isZero() ? null : contribution(row).div(revenue).times(100);
}

export function exposure(row: PortfolioRow) {
  const allowed = new Decimal(row.revenue_usd)
    .times(new Decimal(100).minus(row.target_margin_pct)).div(100);
  return Decimal.max(0, new Decimal(row.known_cost_usd).minus(allowed));
}

export function riskStatus(row: PortfolioRow) {
  if (exposure(row).gt(0)) return "Below floor";
  if (row.unknown_cost_events > 0) return "Cost incomplete";
  if (row.usage_events === 0 && row.completed_outcomes === 0) return "No activity";
  return "Above floor";
}

export function dateRange(input: { from?: string; to?: string }) {
  const today = new Date();
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 30);
  const from = input.from ?? start.toISOString().slice(0, 10);
  const to = input.to ?? end.toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  const first = new Date(`${from}T00:00:00Z`);
  const last = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(first.valueOf()) || Number.isNaN(last.valueOf())
    || first.toISOString().slice(0, 10) !== from || last.toISOString().slice(0, 10) !== to)
    return null;
  const days = (last.valueOf() - first.valueOf()) / 86_400_000;
  return days >= 1 && days <= 62 ? { from, to, days } : null;
}
