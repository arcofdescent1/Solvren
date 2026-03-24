/**
 * Phase 4 — POST /api/integrations/:provider/webhook/replay (§15.1).
 * Replays inbound events from integration_inbound_events; triggers reprocessing.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { hasProvider } from "@/modules/integrations/registry/providerRegistry";
import { getInboundEventById } from "@/modules/integrations/reliability/repositories/integration-inbound-events.repository";
import { replayInboundEventById, replayInboundEventsInRange } from "@/modules/integrations/reliability/services/inbound-replay.service";
import { processOneInboundEvent } from "@/modules/integrations/reliability/services/inbound-processor.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;
    if (!hasProvider(provider)) {
      return NextResponse.json({ ok: false, error: { code: "not_found", message: "Unknown provider" } }, { status: 404 });
    }

    let body: { eventId?: string; orgId?: string; integrationAccountId?: string; fromReceived?: string; toReceived?: string; forceReprocess?: boolean };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      body = {};
    }
    const eventId = body.eventId ?? req.nextUrl.searchParams.get("eventId");
    const admin = createAdminClient();

    if (eventId) {
      const { data: evt } = await getInboundEventById(admin, eventId);
      if (!evt) {
        return NextResponse.json({ ok: false, error: { code: "not_found", message: "Event not found" } }, { status: 404 });
      }
      await requireOrgPermission(parseRequestedOrgId(evt.org_id), "integrations.manage");
      const result = await replayInboundEventById(admin, eventId, { forceReprocess: body.forceReprocess });
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: { code: "replay_failed", message: result.error } }, { status: 400 });
      }
      const { data: refreshed } = await getInboundEventById(admin, eventId);
      if (refreshed) {
        await processOneInboundEvent(admin, refreshed);
      }
      return NextResponse.json({
        ok: true,
        data: { eventId, status: "queued", replayed: result.replayed },
        meta: { timestamp: new Date().toISOString() },
      });
    }

    const fromReceived = body.fromReceived ?? req.nextUrl.searchParams.get("fromReceived");
    const toReceived = body.toReceived ?? req.nextUrl.searchParams.get("toReceived");
    if (fromReceived && toReceived) {
      const integrationAccountId = body.integrationAccountId ?? req.nextUrl.searchParams.get("integrationAccountId");
      const { data: acc } = integrationAccountId
        ? await admin.from("integration_accounts").select("org_id").eq("id", integrationAccountId).maybeSingle()
        : { data: null };
      const orgId = (acc as { org_id?: string } | null)?.org_id;
      if (!orgId) {
        return NextResponse.json({ ok: false, error: { code: "bad_request", message: "integrationAccountId required for range replay" } }, { status: 400 });
      }
      await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.manage");
      const result = await replayInboundEventsInRange(admin, {
        integrationAccountId: integrationAccountId ?? undefined,
        fromReceived,
        toReceived,
      });
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: { code: "replay_failed", message: result.error } }, { status: 500 });
      }
      for (const id of result.eventIds) {
        const { data: evt } = await getInboundEventById(admin, id);
        if (evt) await processOneInboundEvent(admin, evt);
      }
      return NextResponse.json({
        ok: true,
        data: { replayed: result.replayed, eventIds: result.eventIds },
        meta: { timestamp: new Date().toISOString() },
      });
    }

    return NextResponse.json({ ok: false, error: { code: "bad_request", message: "eventId or (fromReceived + toReceived) required" } }, { status: 400 });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
