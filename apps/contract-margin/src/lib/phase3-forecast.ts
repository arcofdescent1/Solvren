import Decimal from "decimal.js";

export type DailyCost = { customer_id: string; day: string; known_cost_usd: string;
  unknown_cost_events: number; completed_outcomes: number; usage_events: number };
export type ContractTerms = { billing_period: string; base_fee_usd: string;
  included_outcomes: number; overage_usd: string; discount_pct: string;
  target_margin_pct: string | null };

function isoDay(value: Date) { return value.toISOString().slice(0, 10); }
function money(value: Decimal.Value) { return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2); }

export function monthlyForecast(customerId: string, daily: DailyCost[], terms: ContractTerms,
  defaultTarget: string, asOf = new Date()) {
  const today = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const nextMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
  const elapsed = Math.round((today.valueOf() - monthStart.valueOf()) / 86_400_000);
  const daysInMonth = Math.round((nextMonth.valueOf() - monthStart.valueOf()) / 86_400_000);
  const remaining = daysInMonth - elapsed;
  const relevant = daily.filter((row) => row.customer_id === customerId && row.day < isoDay(today));
  const month = relevant.filter((row) => row.day >= isoDay(monthStart));
  const start14 = new Date(today); start14.setUTCDate(start14.getUTCDate() - 14);
  const start30 = new Date(today); start30.setUTCDate(start30.getUTCDate() - 30);
  const trailing14 = relevant.filter((row) => row.day >= isoDay(start14));
  const trailing30 = relevant.filter((row) => row.day >= isoDay(start30));
  const sum = (rows: DailyCost[]) => rows.reduce((total, row) => total.plus(row.known_cost_usd), new Decimal(0));
  const observedCost = sum(month);
  const cost14 = sum(trailing14).div(14);
  const cost30 = sum(trailing30).div(30);
  const projected14 = observedCost.plus(cost14.times(remaining));
  const projected30 = observedCost.plus(cost30.times(remaining));
  const completedMonth = month.reduce((total, row) => total + Number(row.completed_outcomes), 0);
  const projectedOutcomes = elapsed > 0 ? Math.ceil(completedMonth / elapsed * daysInMonth) : 0;
  const base = new Decimal(terms.base_fee_usd)
    .div(terms.billing_period === "annual" ? 12 : 1)
    .times(new Decimal(1).minus(new Decimal(terms.discount_pct).div(100)));
  const revenue = base.plus(Decimal.max(0, projectedOutcomes - terms.included_outcomes)
    .times(terms.overage_usd));
  const target = new Decimal(terms.target_margin_pct ?? defaultTarget);
  const allowedCost = revenue.times(new Decimal(1).minus(target.div(100)));
  const unknown = relevant.reduce((total, row) => total + Number(row.unknown_cost_events), 0);
  const active14 = trailing14.filter((row) => Number(row.usage_events) > 0
    || Number(row.completed_outcomes) > 0 || new Decimal(row.known_cost_usd).gt(0)).length;
  const active30 = trailing30.filter((row) => Number(row.usage_events) > 0
    || Number(row.completed_outcomes) > 0 || new Decimal(row.known_cost_usd).gt(0)).length;
  const sufficient = active14 >= 7 && completedMonth >= 30 && unknown === 0;
  const best = active14 >= 7 ? projected14 : projected30;
  return {
    asOf: isoDay(today), monthStart: isoDay(monthStart), monthEndExclusive: isoDay(nextMonth),
    elapsedDays: elapsed, remainingDays: remaining,
    trailing14: { observedDays: active14, knownCostUsd: money(sum(trailing14)),
      dailyRunRateUsd: money(cost14), projectedMonthCostUsd: money(projected14) },
    trailing30: { observedDays: active30, knownCostUsd: money(sum(trailing30)),
      dailyRunRateUsd: money(cost30), projectedMonthCostUsd: money(projected30) },
    monthToDateCostUsd: money(observedCost), monthToDateCompletedOutcomes: completedMonth,
    projectedCompletedOutcomes: projectedOutcomes, projectedRevenueUsd: money(revenue),
    projectedKnownCostUsd: money(best), projectedContributionUsd: money(revenue.minus(best)),
    projectedMarginPct: revenue.gt(0) ? best.div(revenue).neg().plus(1).times(100).toDecimalPlaces(2).toFixed(2) : null,
    floorExposureUsd: money(Decimal.max(0,best.minus(allowedCost))),
    unknownCostEvents: unknown, targetMarginPct: target.toFixed(2),
    confidence: sufficient ? "sufficient_run_rate" : "sparse_or_incomplete",
    method: "Observed month-to-date known cost plus remaining days at trailing 14-day rate when at least seven active days exist; otherwise trailing 30-day rate. Revenue uses the current contract's monthly base and projected completed-outcome overages. No seasonality adjustment.",
  };
}
