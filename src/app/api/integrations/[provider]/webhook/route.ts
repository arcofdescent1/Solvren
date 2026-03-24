/**
 * Phase 1 + Phase 4 — POST /api/integrations/:provider/webhook (§15.1).
 * Persists to integration_inbound_events (durable envelope). No direct raw_events write.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasProvider } from "@/modules/integrations/registry/providerRegistry";
import { phase4WebhookIntake } from "@/modules/integrations/webhooks/phase4WebhookIntake";
import type { IntegrationProvider } from "@/modules/integrations/contracts/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  if (!hasProvider(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const rawBody = await req.text();
  let payload: Record<string, unknown>;
  try {
    payload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
  } catch {
    payload = { raw: rawBody };
  }
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });

  const integrationAccountId = req.headers.get("x-integration-account-id") ?? undefined;
  const eventType = (payload?.type ?? payload?.event_type ?? "unknown") as string;
  const externalId = payload?.id ?? payload?.event_id;
  const p = payload;
  const data = p?.data;
  const obj =
    (data != null && typeof data === "object" ? (data as Record<string, unknown>).object : undefined) ??
    p?.object ??
    payload;
  const externalObjectId = (obj as Record<string, unknown>)?.id ?? (payload?.objectId as string) ?? null;
  const externalObjectType = (obj as Record<string, unknown>)?.object ?? (payload?.objectType as string) ?? null;
  const eventTime = p?.created
    ? new Date((p.created as number) * 1000).toISOString()
    : null;

  const admin = createAdminClient();
  let orgId: string | null = null;
  if (integrationAccountId) {
    const { data: acc } = await admin
      .from("integration_accounts")
      .select("org_id")
      .eq("id", integrationAccountId)
      .maybeSingle();
    orgId = (acc as { org_id: string } | null)?.org_id ?? null;
  }
  if (!orgId) {
    return NextResponse.json({ received: true, warning: "No orgId (x-integration-account-id required)" }, { status: 200 });
  }

  const result = await phase4WebhookIntake(admin, {
    provider: provider as IntegrationProvider,
    orgId,
    integrationAccountId: integrationAccountId ?? null,
    sourceChannel: "webhook",
    externalEventId: externalId != null ? String(externalId) : null,
    externalObjectType: externalObjectType != null ? String(externalObjectType) : null,
    externalObjectId: externalObjectId != null ? String(externalObjectId) : null,
    eventType,
    eventTime,
    payload,
    headers: headers as unknown as Record<string, unknown>,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.statusCode ?? 500 });
  }
  return NextResponse.json({ received: true, eventId: result.eventId, duplicate: result.duplicate });
}
