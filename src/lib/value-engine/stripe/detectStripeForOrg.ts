/**
 * Phase 1 — Stripe detections from raw_events (occurred_at windows).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildIssueKey } from "../issueKey";
import { upsertValueEngineIssue } from "../issuesRepo";

const MS = {
  d7: 7 * 24 * 60 * 60 * 1000,
  d30: 30 * 24 * 60 * 60 * 1000,
  h24: 24 * 60 * 60 * 1000,
};

const LARGE_USD_CENTS = 100_000; // $1,000 (Phase 5 — high-value failures)

type RawEv = {
  event_type: string;
  occurred_at: string;
  payload_json: Record<string, unknown>;
};

function parsePayload(r: RawEv) {
  return r.payload_json ?? {};
}

export async function detectStripeForOrg(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = Date.now();
  const since7 = new Date(now - MS.d7).toISOString();
  const since14 = new Date(now - MS.d7 * 2).toISOString();
  const since30 = new Date(now - MS.d30).toISOString();

  const { data: rows, error } = await supabase
    .from("raw_events")
    .select("event_type, occurred_at, payload_json")
    .eq("org_id", orgId)
    .eq("provider", "stripe")
    .gte("occurred_at", since30);

  if (error) return { ok: false, error: error.message };
  const evs = (rows ?? []) as RawEv[];
  const stripeRevenueFallback = false;

  const piRows = evs.filter((r) => r.event_type === "stripe_pi");
  const chargeRows = evs.filter((r) => r.event_type === "stripe_charge");
  const refundRows = evs.filter((r) => r.event_type === "stripe_refund");
  const invRows = evs.filter((r) => r.event_type === "stripe_invoice_failed");

  const inWindow = (iso: string, since: string) => iso >= since;

  // 0) Subscription renewal failures — invoice failures tied to a subscription (last 7d)
  const renewalIds = new Map<string, number>();
  const renewalSamples: { id: string; label: string }[] = [];
  for (const r of invRows) {
    if (!inWindow(r.occurred_at, since7)) continue;
    const p = parsePayload(r);
    if (!p.subscription && !p.subscription_renewal) continue;
    const id = String(p.id ?? "inv");
    const amt = Number(p.amount_due ?? 0);
    renewalIds.set(id, Math.max(renewalIds.get(id) ?? 0, amt));
    if (renewalSamples.length < 10) renewalSamples.push({ id, label: `Invoice ${id}` });
  }
  if (renewalIds.size > 0) {
    let renewalSum = 0;
    for (const [, v] of renewalIds) renewalSum += v;
    await upsertValueEngineIssue(supabase, {
      org_id: orgId,
      revenue_impact_fallback: stripeRevenueFallback,
      source: "stripe",
      type: "stripe_subscription_renewal_failure",
      title: "Subscription renewal payment failures",
      description: `${renewalIds.size} subscription-linked invoice(s) failed in the last 7 days.`,
      severity: "high",
      revenue_impact_cents: renewalSum,
      affected_count: renewalIds.size,
      confidence: "high",
      issue_key: buildIssueKey(orgId, "stripe", "stripe_subscription_renewal_failure"),
      metadata: { sampleRecords: renewalSamples, windowDays: 7 },
    });
  }

  // 1) Failed payments — PI requires_payment_method OR invoice_failed; window 7d; dedupe by PI id for amounts
  const failedPiIds = new Map<string, number>();
  const failedSamples: { id: string; label: string }[] = [];
  for (const r of piRows) {
    if (!inWindow(r.occurred_at, since7)) continue;
    const p = parsePayload(r);
    const status = String(p.status ?? "");
    if (status === "requires_payment_method" || status === "requires_action") {
      const id = String(p.id ?? "");
      const amt = Number(p.amount ?? 0);
      const prev = failedPiIds.get(id) ?? 0;
      failedPiIds.set(id, Math.max(prev, amt));
    }
  }
  for (const r of invRows) {
    if (!inWindow(r.occurred_at, since7)) continue;
    const p = parsePayload(r);
    if (p.subscription || p.subscription_renewal) continue;
    const id = String(p.id ?? "inv");
    const amt = Number(p.amount_due ?? 0);
    failedPiIds.set(`inv:${id}`, (failedPiIds.get(`inv:${id}`) ?? 0) + amt);
    if (failedSamples.length < 10)
      failedSamples.push({ id, label: `Invoice ${id}` });
  }
  for (const r of piRows) {
    if (!inWindow(r.occurred_at, since7)) continue;
    const p = parsePayload(r);
    const status = String(p.status ?? "");
    if (status === "requires_payment_method" && failedSamples.length < 10) {
      failedSamples.push({ id: String(p.id), label: `PaymentIntent ${String(p.id).slice(0, 14)}…` });
    }
  }

  let failedTotal = 0;
  for (const [, v] of failedPiIds) failedTotal += v;
  const failedCount = failedPiIds.size;

  if (failedCount > 0) {
    const key = buildIssueKey(orgId, "stripe", "stripe_failed_payments");
    await upsertValueEngineIssue(supabase, {
      org_id: orgId,
      revenue_impact_fallback: stripeRevenueFallback,
      source: "stripe",
      type: "stripe_failed_payments",
      title: "Failed payments detected",
      description: `Found ${failedCount} failed or blocked payment intents/invoices in the last 7 days (USD cents summed where available).`,
      severity: "high",
      revenue_impact_cents: failedTotal,
      affected_count: failedCount,
      confidence: "high",
      issue_key: key,
      metadata: {
        sampleRecords: failedSamples.slice(0, 10),
        windowDays: 7,
      },
    });
  }

  // 2) High refund rate — 30d
  let refundSum = 0;
  let refundSum7 = 0;
  let chargePaidSum = 0;
  for (const r of refundRows) {
    if (!inWindow(r.occurred_at, since30)) continue;
    refundSum += Number(parsePayload(r).amount ?? 0);
  }
  for (const r of refundRows) {
    if (!inWindow(r.occurred_at, since7)) continue;
    refundSum7 += Number(parsePayload(r).amount ?? 0);
  }
  for (const r of chargeRows) {
    if (!inWindow(r.occurred_at, since30)) continue;
    const p = parsePayload(r);
    if (p.paid === true) chargePaidSum += Number(p.amount ?? 0);
  }
  const refundRate = chargePaidSum > 0 ? refundSum / chargePaidSum : 0;
  if (chargePaidSum > 0 && refundRate > 0.1) {
    await upsertValueEngineIssue(supabase, {
      org_id: orgId,
      revenue_impact_fallback: stripeRevenueFallback,
      source: "stripe",
      type: "stripe_high_refund_rate",
      title: "Refund rate above 10%",
      description: `Refunds ${refundSum} vs successful charges ${chargePaidSum} (${(refundRate * 100).toFixed(1)}%) in the last 30 days.`,
      severity: "medium",
      revenue_impact_cents: refundSum,
      affected_count: refundRows.filter((r) => inWindow(r.occurred_at, since30)).length,
      confidence: "high",
      issue_key: buildIssueKey(orgId, "stripe", "stripe_high_refund_rate"),
      metadata: { windowDays: 30, refundRate },
    });
  }

  // 2b) Refund spike vs 30-day run rate — last 7d refunds > 2× expected weekly from 30d average
  const weeklyFrom30 = refundSum > 0 ? (refundSum / 30) * 7 : 0;
  if (refundSum > 0 && refundSum7 > 2 * Math.max(weeklyFrom30, 1) && refundSum7 >= 50_000) {
    await upsertValueEngineIssue(supabase, {
      org_id: orgId,
      revenue_impact_fallback: stripeRevenueFallback,
      source: "stripe",
      type: "stripe_refund_spike_anomaly",
      title: "Refund volume spike vs baseline",
      description: `Refund volume in the last 7 days exceeds twice the weekly rate implied by the last 30 days.`,
      severity: "medium",
      revenue_impact_cents: refundSum7,
      affected_count: refundRows.filter((r) => inWindow(r.occurred_at, since7)).length,
      confidence: "medium",
      issue_key: buildIssueKey(orgId, "stripe", "stripe_refund_spike_anomaly"),
      metadata: { refundSum7, refundSum30: refundSum, weeklyFrom30 },
    });
  }

  // 2c) Churn spike — canceled subscriptions last 7d vs prior 7d
  const canceledRows = evs.filter((r) => r.event_type === "stripe_subscription_canceled");
  const canceledLast7 = canceledRows.filter((r) => r.occurred_at >= since7).length;
  const canceledPrev7 = canceledRows.filter((r) => r.occurred_at >= since14 && r.occurred_at < since7).length;
  if (canceledLast7 >= 2 && canceledLast7 > 2 * Math.max(canceledPrev7, 1)) {
    await upsertValueEngineIssue(supabase, {
      org_id: orgId,
      revenue_impact_fallback: stripeRevenueFallback,
      source: "stripe",
      type: "stripe_churn_spike",
      title: "Subscription churn spike",
      description: `Canceled subscriptions in the last 7 days (${canceledLast7}) exceed twice the prior 7-day period (${canceledPrev7}).`,
      severity: "high",
      revenue_impact_cents: 0,
      affected_count: canceledLast7,
      confidence: "medium",
      issue_key: buildIssueKey(orgId, "stripe", "stripe_churn_spike"),
      metadata: { canceledLast7, canceledPrev7 },
    });
  }

  // 2d) Payment methods expiring within ingestion horizon (30d)
  const pmRows = evs.filter((r) => r.event_type === "stripe_card_expiring");
  if (pmRows.length > 0) {
    await upsertValueEngineIssue(supabase, {
      org_id: orgId,
      revenue_impact_fallback: stripeRevenueFallback,
      source: "stripe",
      type: "stripe_payment_method_expiration_risk",
      title: "Payment methods expiring soon",
      description: `${pmRows.length} saved card(s) expire within the next 30 days.`,
      severity: "medium",
      revenue_impact_cents: 0,
      affected_count: pmRows.length,
      confidence: "high",
      issue_key: buildIssueKey(orgId, "stripe", "stripe_payment_method_expiration_risk"),
      metadata: { sampleCount: Math.min(pmRows.length, 10) },
    });
  }

  // 3) Retry exhaustion — >= 3 charges on same PaymentIntent and PI not succeeded
  const chargesPerPi = new Map<string, number>();
  for (const r of chargeRows) {
    const p = parsePayload(r);
    const pi =
      typeof p.payment_intent === "string"
        ? p.payment_intent
        : p.payment_intent && typeof p.payment_intent === "object"
          ? (p.payment_intent as { id?: string }).id
          : null;
    if (!pi) continue;
    chargesPerPi.set(pi, (chargesPerPi.get(pi) ?? 0) + 1);
  }
  const piStatus = new Map<string, string>();
  for (const r of piRows) {
    const p = parsePayload(r);
    piStatus.set(String(p.id ?? ""), String(p.status ?? ""));
  }
  const retrySamples: { id: string; label: string }[] = [];
  let retryCount = 0;
  for (const [piId, n] of chargesPerPi) {
    if (n < 3) continue;
    const st = piStatus.get(piId) ?? "";
    if (st === "succeeded") continue;
    retryCount += 1;
    if (retrySamples.length < 10) {
      retrySamples.push({ id: piId, label: `PI ${piId.slice(0, 12)}… (${n} charge attempts)` });
    }
  }
  if (retryCount > 0) {
    await upsertValueEngineIssue(supabase, {
      org_id: orgId,
      revenue_impact_fallback: stripeRevenueFallback,
      source: "stripe",
      type: "stripe_retry_exhaustion",
      title: "Payments hit retry exhaustion",
      description: `${retryCount} payment intent(s) reached 3+ attempts without success.`,
      severity: "high",
      revenue_impact_cents: 0,
      affected_count: retryCount,
      confidence: "high",
      issue_key: buildIssueKey(orgId, "stripe", "stripe_retry_exhaustion"),
      metadata: { sampleRecords: retrySamples },
    });
  }

  // 4) Drop-off — requires_payment_method AND created > 24h ago
  let dropCount = 0;
  const dropSamples: { id: string; label: string }[] = [];
  for (const r of piRows) {
    const p = parsePayload(r);
    if (String(p.status ?? "") !== "requires_payment_method") continue;
    const createdSec = Number(p.created ?? 0) * 1000;
    if (createdSec && now - createdSec > MS.h24) {
      dropCount += 1;
      if (dropSamples.length < 10) {
        dropSamples.push({ id: String(p.id), label: `PI ${String(p.id).slice(0, 12)}…` });
      }
    }
  }
  if (dropCount > 0) {
    await upsertValueEngineIssue(supabase, {
      org_id: orgId,
      revenue_impact_fallback: stripeRevenueFallback,
      source: "stripe",
      type: "stripe_payment_dropoff",
      title: "Checkout drop-offs (stuck requiring payment method)",
      description: `${dropCount} payment intent(s) still require a payment method after 24+ hours.`,
      severity: "medium",
      revenue_impact_cents: 0,
      affected_count: dropCount,
      confidence: "high",
      issue_key: buildIssueKey(orgId, "stripe", "stripe_payment_dropoff"),
      metadata: { sampleRecords: dropSamples },
    });
  }

  // 5) Large failed transaction — > $500 on failed path (requires_payment_method + amount)
  let largeSum = 0;
  let largeN = 0;
  const largeSamples: { id: string; label: string }[] = [];
  for (const r of piRows) {
    if (!inWindow(r.occurred_at, since7)) continue;
    const p = parsePayload(r);
    const status = String(p.status ?? "");
    if (status !== "requires_payment_method" && status !== "requires_action") continue;
    const amt = Number(p.amount ?? 0);
    if (amt > LARGE_USD_CENTS) {
      largeSum += amt;
      largeN += 1;
      if (largeSamples.length < 10) {
        largeSamples.push({
          id: String(p.id),
          label: `$${(amt / 100).toFixed(0)} on PI ${String(p.id).slice(0, 10)}…`,
        });
      }
    }
  }
  if (largeN > 0) {
    await upsertValueEngineIssue(supabase, {
      org_id: orgId,
      revenue_impact_fallback: stripeRevenueFallback,
      source: "stripe",
      type: "stripe_high_value_payment_failure",
      title: "High-value payment failures (over $1,000)",
      description: `${largeN} failed payment intent(s) exceed $1,000 USD each (summed for impact).`,
      severity: "high",
      revenue_impact_cents: largeSum,
      affected_count: largeN,
      confidence: "high",
      issue_key: buildIssueKey(orgId, "stripe", "stripe_high_value_payment_failure"),
      metadata: { sampleRecords: largeSamples, thresholdUsd: 1000 },
    });
  }

  return { ok: true };
}
