/**
 * Phase 3 — POST /api/admin/dead-letter/:id/retry (§15).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getRawEventById } from "@/modules/signals/persistence/raw-events.repository";
import { processRawEvent } from "@/modules/signals/processing/signal-processor.service";
import { updateDeadLetterEvent, getDeadLetterById } from "@/modules/signals/persistence/dead-letter.repository";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "Unauthorized" } }, { status: 401 });
  }

  const { id: dleId } = await params;
  const { data: dle } = await getDeadLetterById(supabase, dleId);
  if (!dle) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Dead letter not found" } }, { status: 404 });
  }

  const { data: memberships } = await supabase.from("organization_members").select("org_id").eq("user_id", userRes.user.id);
  const orgIds = (memberships ?? []).map((m) => (m as { org_id: string }).org_id);
  if (!orgIds.includes(dle.org_id)) {
    return NextResponse.json({ ok: false, error: { code: "forbidden", message: "Forbidden" } }, { status: 403 });
  }

  const { data: rawEvent } = await getRawEventById(supabase, dle.raw_event_id);
  if (!rawEvent) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Raw event not found" } }, { status: 404 });
  }

  await supabase.from("raw_events").update({
    processing_status: "pending",
    updated_at: new Date().toISOString(),
  }).eq("id", rawEvent.id);

  const result = await processRawEvent(supabase, rawEvent);
  await updateDeadLetterEvent(supabase, dleId, {
    retry_count: dle.retry_count + 1,
    last_retry_at: new Date().toISOString(),
    status: result.ok ? "resolved" : "pending",
    resolution: result.ok ? "retry_succeeded" : null,
    resolved_at: result.ok ? new Date().toISOString() : null,
    resolved_by: result.ok ? userRes.user.id : null,
  });

  return NextResponse.json({
    ok: true,
    data: { success: result.ok, signalId: result.ok ? result.signalId : null },
    meta: { timestamp: new Date().toISOString() },
  });
}
