/**
 * Phase 1 — POST /api/integrations/:provider/webhook/replay (§15.1). Replay a webhook event by ID.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasProvider } from "@/modules/integrations/registry/providerRegistry";
import { updateWebhookEventProcessed } from "@/modules/integrations/core/integrationWebhookRepo";
import type { WebhookProcessedStatus } from "@/modules/integrations/contracts/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "Unauthorized" } }, { status: 401 });
  }

  const { provider } = await params;
  if (!hasProvider(provider)) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Unknown provider" } }, { status: 404 });
  }

  let body: { eventId?: string };
  try {
    body = (await req.json()) as { eventId?: string };
  } catch {
    body = {};
  }
  const eventId = body.eventId ?? req.nextUrl.searchParams.get("eventId");
  if (!eventId) {
    return NextResponse.json({ ok: false, error: { code: "bad_request", message: "eventId required" } }, { status: 400 });
  }

  const { data: row } = await supabase
    .from("integration_webhook_events")
    .select("integration_account_id, provider")
    .eq("id", eventId)
    .maybeSingle();
  if (!row) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Event not found" } }, { status: 404 });
  }
  const accountId = (row as { integration_account_id: string | null }).integration_account_id;
  if (accountId) {
    const { data: account } = await supabase.from("integration_accounts").select("org_id").eq("id", accountId).maybeSingle();
    if (account) {
      const { data: member } = await supabase
        .from("organization_members")
        .select("org_id")
        .eq("org_id", (account as { org_id: string }).org_id)
        .eq("user_id", userRes.user.id)
        .maybeSingle();
      if (!member) {
        return NextResponse.json({ ok: false, error: { code: "forbidden", message: "Forbidden" } }, { status: 403 });
      }
    }
  }

  const { error } = await updateWebhookEventProcessed(
    supabase,
    eventId,
    "received" as WebhookProcessedStatus
  );
  if (error) {
    return NextResponse.json({ ok: false, error: { code: "server_error", message: error.message } }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    data: { eventId, status: "received", message: "Event marked for reprocessing" },
    meta: { timestamp: new Date().toISOString() },
  });
}
