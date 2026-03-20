/**
 * HubSpot webhook endpoint. IES §16.
 * Phase 3: validates signature via HubSpot validator, persists to raw_events for signal pipeline.
 */
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateHubSpotWebhook } from "@/modules/signals/ingestion/webhook-validators/hubspot.validator";
import { persistWebhookToRawEvents } from "@/modules/signals/ingestion/webhook-to-raw-event.bridge";

export async function POST(req: NextRequest) {
  if (!env.hubspotIntegrationEnabled) return NextResponse.json({ error: "HubSpot not configured" }, { status: 503 });
  const rawBody = await req.text();
  const signature = req.headers.get("x-hubspot-signature");
  const signatureV3 = req.headers.get("x-hubspot-signature-v3");
  const timestamp = req.headers.get("x-hubspot-request-timestamp");
  const clientSecret = env.hubspotClientSecret ?? null;

  const validation = validateHubSpotWebhook(
    rawBody,
    signature,
    signatureV3,
    timestamp,
    clientSecret,
    "POST",
    req.url ?? ""
  );
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error ?? "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
  } catch {
    payload = { raw: rawBody };
  }

  const portalId = (payload.portalId ?? payload.portal_id ?? (payload as { subscriptionDetails?: Array<{ portalId?: number }> }).subscriptionDetails?.[0]?.portalId) as number | undefined;
  if (portalId == null) {
    return NextResponse.json({ received: true, warning: "No portalId in payload, skipping raw event persist" }, { status: 200 });
  }

  const admin = createAdminClient();
  const { data: hubAccount } = await admin
    .from("hubspot_accounts")
    .select("org_id")
    .eq("hub_id", portalId)
    .maybeSingle();
  const orgId = (hubAccount as { org_id: string } | null)?.org_id;
  if (!orgId) {
    return NextResponse.json({ received: true, warning: "Unknown portal, skipping raw event persist" }, { status: 200 });
  }

  const subscriptionType = (payload.subscriptionType ?? payload.subscription_type) as string | undefined;
  const objectId = (payload.objectId ?? payload.object_id) as string | undefined;
  const occurredAt = (payload.occurredAt ?? payload.occurred_at ?? Date.now()) as number | string | undefined;
  const eventTime = occurredAt
    ? (typeof occurredAt === "number" ? new Date(occurredAt).toISOString() : String(occurredAt))
    : null;

  await persistWebhookToRawEvents(admin, {
    orgId,
    integrationAccountId: null,
    provider: "hubspot",
    sourceChannel: "webhook",
    externalEventId: ((payload.eventId ?? payload.event_id ?? payload.requestId) as string | undefined) ?? null,
    externalObjectType: subscriptionType ?? "unknown",
    externalObjectId: objectId ?? null,
    eventType: subscriptionType ?? "hubspot.webhook",
    eventTime,
    payload,
    headers: Object.fromEntries(req.headers.entries()),
  });

  return NextResponse.json({ received: true });
}
