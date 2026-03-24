/**
 * Phase 2 + Phase 4 — Stripe webhook endpoint.
 * Validates signature, persists to integration_inbound_events (durable envelope).
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revealCredentialTokenFields } from "@/lib/server/integrationTokenFields";
import { validateStripeWebhook } from "@/modules/signals/ingestion/webhook-validators/stripe.validator";
import { getStripeClientForOrg } from "@/modules/integrations/providers/stripe/stripeClientForOrg";
import { phase4WebhookIntake } from "@/modules/integrations/webhooks/phase4WebhookIntake";
import { getStripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature") ?? undefined;

  const orgId = req.headers.get("x-org-id") ?? req.nextUrl.searchParams.get("orgId");
  let webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? undefined;
  if (orgId) {
    const admin = createAdminClient();
    const { data: creds } = await admin
      .from("integration_credentials")
      .select("client_secret")
      .eq("org_id", orgId)
      .eq("provider", "stripe")
      .maybeSingle();
    const revealed = creds ? revealCredentialTokenFields(creds as Record<string, unknown>) as { client_secret?: string } : null;
    const perOrg = revealed?.client_secret;
    if (perOrg) webhookSecret = perOrg;
  }

  const stripe = orgId ? await getStripeClientForOrg(orgId) : getStripe();
  const validation = validateStripeWebhook(stripe ?? null, rawBody, signature ?? "", webhookSecret ?? "");

  if (!validation.valid) {
    return NextResponse.json({ error: validation.error ?? "Invalid signature" }, { status: 401 });
  }

  const payload = validation.payload as { id?: string; type?: string; data?: { object?: unknown }; created?: number };
  if (!payload) {
    return NextResponse.json({ received: true });
  }

  const eventType = payload.type ?? "unknown";
  const obj = payload.data?.object ?? payload;
  const objectType = (eventType.split(".")[0] ?? "unknown") as string;

  const resolvedOrgId = orgId;
  if (!resolvedOrgId) {
    return NextResponse.json({ received: true, warning: "No orgId, skipping persist" }, { status: 200 });
  }

  const admin = createAdminClient();
  const result = await phase4WebhookIntake(admin, {
    provider: "stripe",
    orgId: resolvedOrgId,
    sourceChannel: "webhook",
    externalEventId: payload.id,
    externalObjectType: objectType,
    externalObjectId: (obj as Record<string, unknown>)?.id as string,
    eventType,
    eventTime: payload.created ? new Date(payload.created * 1000).toISOString() : undefined,
    payload: obj as Record<string, unknown>,
    headers: Object.fromEntries(req.headers.entries()) as unknown as Record<string, unknown>,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.statusCode ?? 500 });
  }
  return NextResponse.json({ received: true, eventId: result.eventId, duplicate: result.duplicate });
}
