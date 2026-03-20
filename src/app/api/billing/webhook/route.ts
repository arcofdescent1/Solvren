import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { persistWebhookToRawEvents } from "@/modules/signals/ingestion/webhook-to-raw-event.bridge";

function planKeyFromPriceId(priceId: string | null): "FREE" | "TEAM" | "BUSINESS" {
  if (!priceId) return "FREE";
  if (priceId === env.stripePriceTeam) return "TEAM";
  if (priceId === env.stripePriceBusiness) return "BUSINESS";
  return "TEAM";
}

function statusKey(subStatus: string | null | undefined) {
  const s = (subStatus ?? "active").toUpperCase();
  if (s === "ACTIVE") return "ACTIVE";
  if (s === "TRIALING") return "TRIALING";
  if (s === "PAST_DUE") return "PAST_DUE";
  if (s === "CANCELED") return "CANCELED";
  if (s === "INCOMPLETE") return "INCOMPLETE";
  return "ACTIVE";
}

export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = env.stripeWebhookSecret;
  if (!stripe || !secret) {
    return NextResponse.json(
      { error: "Billing integration disabled: Stripe webhook not configured" },
      { status: 503 }
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig)
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );

  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch {
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  try {
    if (event.type.startsWith("customer.subscription.")) {
      const sub = event.data.object as Stripe.Subscription;

      const customerId = String(sub.customer);
      const subId = sub.id;
      const priceId = sub.items.data[0]?.price?.id ?? null;

      let orgId = (sub.metadata?.org_id as string) || null;

      if (!orgId) {
        const { data } = await admin
          .from("billing_accounts")
          .select("org_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();
        orgId = (data?.org_id as string) ?? null;
      }

      if (orgId) {
        await persistWebhookToRawEvents(admin, {
          orgId,
          integrationAccountId: null,
          provider: "stripe",
          sourceChannel: "webhook",
          externalEventId: event.id,
          externalObjectType: "customer.subscription",
          externalObjectId: subId,
          eventType: event.type,
          eventTime: event.created ? new Date(event.created * 1000).toISOString() : null,
          payload: event as unknown as Record<string, unknown>,
          headers: null,
        });
        const planKey = planKeyFromPriceId(priceId);
        await admin.from("billing_accounts").upsert(
          {
            org_id: orgId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subId,
            plan_key: planKey,
            status: statusKey(sub.status),
            current_period_end: (() => {
              const end = (sub as unknown as { current_period_end?: number }).current_period_end;
              return end ? new Date(end * 1000).toISOString() : null;
            })(),
          },
          { onConflict: "org_id" }
        );
        const planTier =
          planKey === "TEAM" ? "PRO" : planKey === "BUSINESS" ? "BUSINESS" : "FREE";
        await admin
          .from("organizations")
          .update({ plan_tier: planTier })
          .eq("id", orgId);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Webhook error" },
      { status: 500 }
    );
  }
}
