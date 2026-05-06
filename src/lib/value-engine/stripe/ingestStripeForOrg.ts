/**
 * Phase 1 — Stripe list ingestion → raw_events (cursor pagination, 90d cap on first backfill).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { upsertNormalizedRawEvent } from "../upsertNormalizedRawEvent";
import { revealCredentialTokenFields } from "@/lib/server/integrationTokenFields";
import { systemCredentialReveal } from "@/modules/integrations/secrets/integration-secrets.service";

const NINETY_DAYS_SEC = 90 * 24 * 60 * 60;

type VeConfig = {
  valueEngine?: {
    stripeBackfillComplete?: boolean;
    stripeMaxCreated?: number;
  };
};

function redactPi(pi: Stripe.PaymentIntent): Record<string, unknown> {
  return {
    id: pi.id,
    status: pi.status,
    amount: pi.amount,
    currency: pi.currency,
    created: pi.created,
    payment_attempts: (pi as { attempt_count?: number }).attempt_count ?? undefined,
    customer: pi.customer ? "[redacted]" : null,
    last_payment_error: pi.last_payment_error?.message ? { message: "[redacted]" } : null,
  };
}

function redactCharge(c: Stripe.Charge): Record<string, unknown> {
  const pi =
    typeof c.payment_intent === "string"
      ? c.payment_intent
      : c.payment_intent && typeof c.payment_intent === "object"
        ? (c.payment_intent as { id?: string }).id
        : undefined;
  return {
    id: c.id,
    amount: c.amount,
    currency: c.currency,
    created: c.created,
    paid: c.paid,
    refunded: c.refunded,
    failure_code: c.failure_code ?? null,
    payment_intent: pi ?? null,
    customer: c.customer ? "[redacted]" : null,
  };
}

function redactRefund(r: Stripe.Refund): Record<string, unknown> {
  return {
    id: r.id,
    amount: r.amount,
    currency: r.currency,
    created: r.created,
    charge: typeof r.charge === "string" ? r.charge : r.charge?.id,
  };
}

function redactInvoice(inv: Stripe.Invoice): Record<string, unknown> {
  const subField = (inv as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }).subscription;
  const subscriptionId =
    typeof subField === "string"
      ? subField
      : subField && typeof subField === "object"
        ? (subField as { id?: string }).id ?? null
        : null;
  return {
    id: inv.id,
    status: inv.status,
    amount_due: inv.amount_due,
    currency: inv.currency,
    created: inv.created,
    attempt_count: inv.attempt_count,
    subscription: subscriptionId,
    subscription_renewal: Boolean(subscriptionId),
    last_finalization_error: inv.last_finalization_error?.message ? { message: "[redacted]" } : null,
  };
}

export async function ingestStripeForOrg(
  supabase: SupabaseClient,
  orgId: string,
  opts: { mode: "backfill" | "incremental" }
): Promise<{ ok: true; wrote: number } | { ok: false; error: string }> {
  const { data: credsRaw } = await supabase
    .from("integration_credentials")
    .select("access_token")
    .eq("org_id", orgId)
    .eq("provider", "stripe")
    .maybeSingle();

  const access = revealCredentialTokenFields(
    credsRaw as Record<string, unknown>,
    systemCredentialReveal(orgId, "stripe", "scheduled_sync"),
  ).access_token as string | undefined;
  if (!access?.trim()) return { ok: false, error: "No Stripe credentials for org" };

  const stripe = new Stripe(access.trim(), { apiVersion: "2024-06-20" as Stripe.LatestApiVersion });

  const { data: conn } = await supabase
    .from("integration_connections")
    .select("config, last_synced_at")
    .eq("org_id", orgId)
    .eq("provider", "stripe")
    .maybeSingle();

  const config = ((conn as { config?: VeConfig } | null)?.config ?? {}) as VeConfig;
  const ve = config.valueEngine ?? {};
  const nowSec = Math.floor(Date.now() / 1000);
  const ninetyAgo = nowSec - NINETY_DAYS_SEC;
  const lastSyncIso = (conn as { last_synced_at?: string } | null)?.last_synced_at;
  const overlapSec = 2 * 60 * 60; // 2h overlap on incremental

  let createdGte = ninetyAgo;
  if (opts.mode === "incremental") {
    if (lastSyncIso) {
      createdGte = Math.max(Math.floor(new Date(lastSyncIso).getTime() / 1000) - overlapSec, ninetyAgo);
    } else if (ve.stripeMaxCreated) {
      createdGte = Math.max(ve.stripeMaxCreated - overlapSec, ninetyAgo);
    }
  }

  let maxSeen = ve.stripeMaxCreated ?? 0;
  let wrote = 0;

  const runPi = async (startingAfter?: string) => {
    const list = await stripe.paymentIntents.list({
      limit: 100,
      created: { gte: createdGte, lte: nowSec },
      starting_after: startingAfter,
    });
    for (const pi of list.data) {
      maxSeen = Math.max(maxSeen, pi.created);
      const r = await upsertNormalizedRawEvent(supabase, {
        orgId,
        provider: "stripe",
        sourceChannel: opts.mode === "backfill" ? "backfill" : "incremental_sync",
        externalId: pi.id,
        eventType: "stripe_pi",
        occurredAt: new Date(pi.created * 1000).toISOString(),
        payload: redactPi(pi),
      });
      if (r.ok) wrote += 1;
    }
    if (list.has_more && list.data.length > 0) {
      await runPi(list.data[list.data.length - 1].id);
    }
  };

  const runCharges = async (startingAfter?: string) => {
    const list = await stripe.charges.list({
      limit: 100,
      created: { gte: createdGte, lte: nowSec },
      starting_after: startingAfter,
    });
    for (const c of list.data) {
      maxSeen = Math.max(maxSeen, c.created);
      const r = await upsertNormalizedRawEvent(supabase, {
        orgId,
        provider: "stripe",
        sourceChannel: opts.mode === "backfill" ? "backfill" : "incremental_sync",
        externalId: c.id,
        eventType: "stripe_charge",
        occurredAt: new Date(c.created * 1000).toISOString(),
        payload: redactCharge(c),
      });
      if (r.ok) wrote += 1;
    }
    if (list.has_more && list.data.length > 0) {
      await runCharges(list.data[list.data.length - 1].id);
    }
  };

  const runRefunds = async (startingAfter?: string) => {
    const list = await stripe.refunds.list({
      limit: 100,
      created: { gte: createdGte, lte: nowSec },
      starting_after: startingAfter,
    });
    for (const r of list.data) {
      maxSeen = Math.max(maxSeen, r.created);
      const res = await upsertNormalizedRawEvent(supabase, {
        orgId,
        provider: "stripe",
        sourceChannel: opts.mode === "backfill" ? "backfill" : "incremental_sync",
        externalId: r.id,
        eventType: "stripe_refund",
        occurredAt: new Date(r.created * 1000).toISOString(),
        payload: redactRefund(r),
      });
      if (res.ok) wrote += 1;
    }
    if (list.has_more && list.data.length > 0) {
      await runRefunds(list.data[list.data.length - 1].id);
    }
  };

  const runInvoices = async (startingAfter?: string) => {
    const list = await stripe.invoices.list({
      limit: 100,
      created: { gte: createdGte, lte: nowSec },
      starting_after: startingAfter,
    });
    for (const inv of list.data) {
      maxSeen = Math.max(maxSeen, inv.created ?? 0);
      const failed = inv.last_finalization_error != null || inv.status === "uncollectible";
      if (!failed) continue;
      const res = await upsertNormalizedRawEvent(supabase, {
        orgId,
        provider: "stripe",
        sourceChannel: opts.mode === "backfill" ? "backfill" : "incremental_sync",
        externalId: inv.id ?? inv.number ?? "inv",
        eventType: "stripe_invoice_failed",
        occurredAt: new Date((inv.created ?? nowSec) * 1000).toISOString(),
        payload: redactInvoice(inv),
      });
      if (res.ok) wrote += 1;
    }
    if (list.has_more && list.data.length > 0) {
      await runInvoices(list.data[list.data.length - 1].id);
    }
  };

  const since14Sec = nowSec - 14 * 24 * 60 * 60;

  const runCanceledSubs = async (startingAfter?: string) => {
    const list = await stripe.subscriptions.list({
      status: "canceled",
      limit: 100,
      starting_after: startingAfter,
    });
    for (const s of list.data) {
      const canceledAt = s.canceled_at;
      if (!canceledAt || canceledAt < since14Sec) continue;
      maxSeen = Math.max(maxSeen, canceledAt);
      const res = await upsertNormalizedRawEvent(supabase, {
        orgId,
        provider: "stripe",
        sourceChannel: opts.mode === "backfill" ? "backfill" : "incremental_sync",
        externalId: s.id,
        eventType: "stripe_subscription_canceled",
        occurredAt: new Date(canceledAt * 1000).toISOString(),
        payload: {
          id: s.id,
          canceled_at: canceledAt,
          customer: s.customer ? "[redacted]" : null,
        },
      });
      if (res.ok) wrote += 1;
    }
    if (list.has_more && list.data.length > 0) {
      await runCanceledSubs(list.data[list.data.length - 1].id);
    }
  };

  /** Cards expiring within the next 30 days (org-scoped, capped customers). */
  const runExpiringPaymentMethods = async () => {
    const horizon = new Date();
    horizon.setUTCDate(horizon.getUTCDate() + 30);
    const custList = await stripe.customers.list({ limit: 80 });
    for (const c of custList.data) {
      const pms = await stripe.paymentMethods.list({ customer: c.id, type: "card" });
      for (const pm of pms.data) {
        if (pm.type !== "card" || !pm.card) continue;
        const exp = new Date(Date.UTC(pm.card.exp_year, pm.card.exp_month - 1, 15));
        const nowD = new Date();
        if (!(exp > nowD && exp <= horizon)) continue;
        const res = await upsertNormalizedRawEvent(supabase, {
          orgId,
          provider: "stripe",
          sourceChannel: opts.mode === "backfill" ? "backfill" : "incremental_sync",
          externalId: pm.id,
          eventType: "stripe_card_expiring",
          occurredAt: new Date().toISOString(),
          payload: {
            id: pm.id,
            exp_month: pm.card.exp_month,
            exp_year: pm.card.exp_year,
            last4: pm.card.last4,
            customer: "[redacted]",
          },
        });
        if (res.ok) wrote += 1;
      }
    }
  };

  try {
    await runPi();
    await runCharges();
    await runRefunds();
    await runInvoices();
    await runCanceledSubs();
    await runExpiringPaymentMethods();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "stripe_list_failed" };
  }

  const nextConfig = {
    ...((conn as { config?: Record<string, unknown> } | null)?.config ?? {}),
    valueEngine: {
      ...ve,
      stripeMaxCreated: maxSeen,
      stripeBackfillComplete: opts.mode === "backfill" ? true : ve.stripeBackfillComplete,
    },
  };

  await supabase
    .from("integration_connections")
    .update({
      config: nextConfig,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId)
    .eq("provider", "stripe");

  return { ok: true, wrote };
}
