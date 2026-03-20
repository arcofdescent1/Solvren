/**
 * Phase 3 — POST /api/signals/intake. Raw event intake for webhooks and internal publishers.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { intakeRawEvent } from "@/modules/signals/ingestion/raw-event-intake.service";
import type { SourceChannel } from "@/modules/signals/domain/types";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();

  let body: {
    orgId: string;
    provider: string;
    sourceChannel?: string;
    integrationAccountId?: string;
    externalEventId?: string;
    externalObjectType?: string;
    externalObjectId?: string;
    eventType: string;
    eventTime?: string;
    payload: Record<string, unknown>;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: { code: "bad_request", message: "Invalid JSON" } }, { status: 400 });
  }

  if (!body.orgId || !body.provider || !body.eventType || !body.payload) {
    return NextResponse.json(
      { ok: false, error: { code: "bad_request", message: "orgId, provider, eventType, payload required" } },
      { status: 400 }
    );
  }

  if (userRes?.user) {
    const { data: member } = await supabase
      .from("organization_members")
      .select("org_id")
      .eq("org_id", body.orgId)
      .eq("user_id", userRes.user.id)
      .maybeSingle();
    if (!member) {
      return NextResponse.json({ ok: false, error: { code: "forbidden", message: "Forbidden" } }, { status: 403 });
    }
  }

  const result = await intakeRawEvent(supabase, {
    orgId: body.orgId,
    integrationAccountId: body.integrationAccountId ?? null,
    provider: body.provider,
    sourceChannel: (body.sourceChannel as SourceChannel) ?? "webhook",
    externalEventId: body.externalEventId ?? null,
    externalObjectType: body.externalObjectType ?? null,
    externalObjectId: body.externalObjectId ?? null,
    eventType: body.eventType,
    eventTime: body.eventTime ?? null,
    payload: body.payload,
    headers: null,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: { code: "intake_failed", message: result.error } }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    data: { rawEventId: result.rawEventId, created: result.created },
    meta: { timestamp: new Date().toISOString() },
  });
}
