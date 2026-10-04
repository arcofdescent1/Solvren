import Decimal from "decimal.js";
import { z } from "zod";

const money = z.union([z.string(), z.number()]).transform((value) => String(value))
  .pipe(z.string().regex(/^\d{1,9}(?:\.\d{1,6})?$/));
const percent = z.number().min(0).max(100);
const mixLine = z.strictObject({
  workflowId: z.string().trim().min(1).max(200), sharePct: percent,
  manualMedianUsd: money.nullable(), manualAdverseUsd: money.nullable(),
});
export const quoteScenarioSchema = z.strictObject({
  label: z.string().trim().min(2).max(80),
  monthlyOutcomes: z.number().int().min(1).max(1_000_000),
  proposedFeeUsd: money, discountPct: percent,
  includedOutcomes: z.number().int().min(0).max(1_000_000),
  overageUsd: money, volumeStressPct: z.number().min(0).max(200),
  targetMarginPct: z.number().min(0).max(95),
  mix: z.array(mixLine).min(1).max(5),
}).superRefine((value, ctx) => {
  if (Math.abs(value.mix.reduce((sum, row) => sum + row.sharePct, 0) - 100) > 0.01)
    ctx.addIssue({ code: "custom", message: "Workflow shares must total 100%." });
  if (new Set(value.mix.map((row) => row.workflowId)).size !== value.mix.length)
    ctx.addIssue({ code: "custom", message: "Each workflow may appear once per scenario." });
});
export const quoteReviewSchema = z.strictObject({
  quoteId: z.uuid().nullable(),
  customerName: z.string().trim().min(2).max(200),
  ownerUserId: z.uuid(),
  decision: z.enum(["approve", "revise", "reject"]),
  notes: z.string().trim().min(5).max(4000),
  scenarios: z.array(quoteScenarioSchema).min(1).max(3),
});

export type QuoteScenario = z.infer<typeof quoteScenarioSchema>;
export type WorkflowSample = {
  workflow_id: string; completed_runs: number; priced_runs: number; unknown_runs: number;
  median_unit_usd: string | null; p90_unit_usd: string | null;
  observed_cost_usd: string; first_outcome_at: string | null; last_outcome_at: string | null;
};

function d(value: Decimal.Value) { return new Decimal(value); }
function cents(value: Decimal.Value) { return d(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2); }

export function calculateQuoteScenario(scenario: QuoteScenario, samples: WorkflowSample[]) {
  const evidence = new Map(samples.map((row) => [row.workflow_id, row]));
  const mix = scenario.mix.map((line) => {
    const sample = evidence.get(line.workflowId);
    const sparse = !sample || sample.priced_runs < 30;
    const manual = line.manualMedianUsd !== null || line.manualAdverseUsd !== null;
    if (sparse && (line.manualMedianUsd === null || line.manualAdverseUsd === null))
      throw new Error(`${line.workflowId} has fewer than 30 priced completed outcomes. Enter both manual unit-cost assumptions.`);
    if ((line.manualMedianUsd === null) !== (line.manualAdverseUsd === null))
      throw new Error(`Enter both manual unit-cost assumptions for ${line.workflowId}.`);
    const median = d(line.manualMedianUsd ?? sample?.median_unit_usd ?? 0);
    const adverse = d(line.manualAdverseUsd ?? sample?.p90_unit_usd ?? 0);
    if (adverse.lt(median)) throw new Error(`${line.workflowId} adverse unit cost must be at least the median.`);
    return {
      workflowId: line.workflowId, sharePct: line.sharePct,
      sampleSize: sample?.priced_runs ?? 0, unknownRuns: sample?.unknown_runs ?? 0,
      firstObservedAt: sample?.first_outcome_at ?? null,
      lastObservedAt: sample?.last_outcome_at ?? null,
      basis: manual ? "manual" : sample?.unknown_runs ? "observed_partial" : "observed",
      medianUnitUsd: median.toFixed(6), adverseUnitUsd: adverse.toFixed(6),
    };
  });
  const weightedMedian = mix.reduce((sum, line) => sum.plus(d(line.medianUnitUsd).times(line.sharePct).div(100)), d(0));
  const weightedAdverse = mix.reduce((sum, line) => sum.plus(d(line.adverseUnitUsd).times(line.sharePct).div(100)), d(0));
  const base = d(scenario.proposedFeeUsd).times(d(1).minus(d(scenario.discountPct).div(100)));
  const overage = d(scenario.overageUsd);
  const volume = d(scenario.monthlyOutcomes);
  const stressedVolume = volume.times(d(1).plus(d(scenario.volumeStressPct).div(100))).ceil();
  const revenueAt = (outcomes: Decimal) => base.plus(Decimal.max(0, outcomes.minus(scenario.includedOutcomes)).times(overage));
  const medianRevenue = revenueAt(volume);
  const adverseRevenue = revenueAt(stressedVolume);
  const medianCost = volume.times(weightedMedian);
  const adverseCost = stressedVolume.times(weightedAdverse);
  const rate = (revenue: Decimal, cost: Decimal) => revenue.isZero() ? null
    : revenue.minus(cost).div(revenue).times(100).toDecimalPlaces(2).toFixed(2);
  const target = d(1).minus(d(scenario.targetMarginPct).div(100));
  const requiredAdverseRevenue = adverseCost.div(target);
  const requiredBaseAfterDiscount = Decimal.max(0,requiredAdverseRevenue.minus(
    Decimal.max(0,stressedVolume.minus(scenario.includedOutcomes)).times(overage)));
  const proposedPriceFloor = d(scenario.discountPct).eq(100) ? null
    : cents(requiredBaseAfterDiscount.div(d(1).minus(d(scenario.discountPct).div(100))));
  let breakeven: string | null = null;
  if (weightedMedian.gt(0)) {
    const withinAllowance = base.div(weightedMedian);
    if (withinAllowance.lte(scenario.includedOutcomes)) breakeven = withinAllowance.ceil().toFixed(0);
    else if (weightedMedian.gt(overage))
      breakeven = base.minus(overage.times(scenario.includedOutcomes))
        .div(weightedMedian.minus(overage)).ceil().toFixed(0);
  }
  let maxIncluded: string | null = null;
  if (base.gte(requiredAdverseRevenue)) maxIncluded = stressedVolume.toFixed(0);
  else if (overage.gt(0)) {
    const neededOverages = requiredAdverseRevenue.minus(base).div(overage).ceil();
    const maximum = stressedVolume.minus(neededOverages).floor();
    if (maximum.gte(0)) maxIncluded = maximum.toFixed(0);
  }
  const adverseFloorGap = Decimal.max(0,requiredAdverseRevenue.minus(adverseRevenue));
  const driver = [...mix].sort((a,b) => d(b.adverseUnitUsd).times(b.sharePct)
    .comparedTo(d(a.adverseUnitUsd).times(a.sharePct)))[0];
  return {
    label: scenario.label, methodVersion: "2026-10-quote-v1", assumptions: scenario,
    workflowEvidence: mix,
    median: { outcomes: volume.toFixed(0), revenueUsd: cents(medianRevenue), costUsd: cents(medianCost),
      contributionUsd: cents(medianRevenue.minus(medianCost)), marginPct: rate(medianRevenue,medianCost) },
    adverse: { outcomes: stressedVolume.toFixed(0), revenueUsd: cents(adverseRevenue),
      costUsd: cents(adverseCost), contributionUsd: cents(adverseRevenue.minus(adverseCost)),
      marginPct: rate(adverseRevenue,adverseCost) },
    breakevenOutcomes: breakeven,
    requiredBaseFeeUsd: proposedPriceFloor,
    maximumIncludedOutcomes: maxIncluded,
    adverseFloorGapUsd: cents(adverseFloorGap),
    recommendation: adverseFloorGap.gt(0)
      ? `Adverse usage misses the ${scenario.targetMarginPct}% floor by ${cents(adverseFloorGap)} USD of revenue. ${driver.workflowId} is the largest weighted adverse cost driver. Review a base fee of ${proposedPriceFloor ?? "more than the discounted price can support"} USD or reduce the included allowance${maxIncluded === null ? " with a viable overage price" : ` to at most ${maxIncluded}`}.`
      : `Adverse usage clears the ${scenario.targetMarginPct}% floor under these assumptions. Confirm the signed terms and recheck as cost evidence changes.`,
    confidence: mix.some((row) => row.basis === "manual") ? "manual_assumptions"
      : mix.some((row) => row.basis === "observed_partial") ? "partial_observation" : "observed",
  };
}
