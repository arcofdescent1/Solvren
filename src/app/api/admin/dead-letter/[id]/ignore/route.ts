/**
 * Phase 3 — POST /api/admin/dead-letter/:id/ignore (§15).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getRawEventById } from "@/modules/signals/persistence/raw-events.repository";
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

  await updateDeadLetterEvent(supabase, dleId, {
    status: "ignored",
    resolution: "manual_ignore",
    resolved_at: new Date().toISOString(),
    resolved_by: userRes.user.id,
  });

  await supabase.from("raw_events").update({
    processing_status: "processed",
    updated_at: new Date().toISOString(),
  }).eq("id", dle.raw_event_id);

  return NextResponse.json({
    ok: true,
    data: { ignored: true },
    meta: { timestamp: new Date().toISOString() },
  });
}
