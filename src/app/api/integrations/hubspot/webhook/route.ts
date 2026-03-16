import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

/**
 * HubSpot webhook endpoint. IES §16.
 * Validates signature, enqueues for async processing.
 * Phase 2B: implement signature validation and hubspot_webhook_events insertion.
 */
export async function POST(req: NextRequest) {
  if (!env.hubspotIntegrationEnabled) return NextResponse.json({ error: "HubSpot not configured" }, { status: 503 });
  const raw = await req.text();
  const signature = req.headers.get("x-hubspot-signature");
  const sigVersion = req.headers.get("x-hubspot-signature-version");
  if (env.hubspotClientSecret && (!signature || !sigVersion)) {
    return NextResponse.json({ error: "Missing webhook signature" }, { status: 401 });
  }
  return NextResponse.json({ received: true });
}
