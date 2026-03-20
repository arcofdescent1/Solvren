/**
 * Phase 1 — POST /api/integrations/:provider/webhook (§15.1). Ingest webhook event.
 * Phase 3 — Persist to raw_events first for signal pipeline.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestWebhook } from "@/modules/integrations/webhooks/webhookIngestionService";
import { hasProvider } from "@/modules/integrations/registry/providerRegistry";
import { persistWebhookToRawEvents } from "@/modules/signals/ingestion/webhook-to-raw-event.bridge";
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
  let payload: unknown;
  try {
    payload = rawBody ? (JSON.parse(rawBody) as unknown) : {};
  } catch {
    payload = { raw: rawBody };
  }
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });

  const supabase = await createServerSupabaseClient();
  const integrationAccountId = req.headers.get("x-integration-account-id") ?? undefined;
  const eventType = (payload as Record<string, unknown>)?.type as string ?? (payload as Record<string, unknown>)?.event_type as string ?? "unknown";
  const externalId = (payload as Record<string, unknown>)?.id ?? (payload as Record<string, unknown>)?.event_id;

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
  if (orgId) {
    const p = payload as Record<string, unknown>;
    const data = p?.data;
    const obj =
      (data != null && typeof data === "object" ? (data as Record<string, unknown>).object : undefined) ??
      p?.object ??
      payload;
    const externalObjectId = (obj as Record<string, unknown>)?.id ?? (payload as Record<string, unknown>)?.objectId ?? null;
    const externalObjectType = (obj as Record<string, unknown>)?.object ?? (payload as Record<string, unknown>)?.objectType ?? null;
    const eventTime = (payload as Record<string, unknown>)?.created
      ? new Date(((payload as Record<string, unknown>).created as number) * 1000).toISOString()
      : null;
    await persistWebhookToRawEvents(admin, {
      orgId,
      integrationAccountId: integrationAccountId || null,
      provider,
      sourceChannel: "webhook",
      externalEventId: externalId != null ? String(externalId) : null,
      externalObjectType: externalObjectType != null ? String(externalObjectType) : null,
      externalObjectId: externalObjectId != null ? String(externalObjectId) : null,
      eventType,
      eventTime,
      payload: typeof payload === "object" && payload !== null ? payload as Record<string, unknown> : { raw: payload },
      headers,
    });
  }

  const result = await ingestWebhook(supabase, {
    provider: provider as IntegrationProvider,
    integrationAccountId: integrationAccountId || null,
    eventType,
    payload,
    headers,
    signatureValid: undefined,
    externalEventId: externalId != null ? String(externalId) : null,
    dedupeKey: externalId != null ? String(externalId) : undefined,
  });

  if (result.processedStatus === "duplicate") {
    return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
  }
  return NextResponse.json({ received: true, eventId: result.eventId }, { status: 200 });
}
