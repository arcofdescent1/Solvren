/**
 * Phase 3 — POST /api/admin/dead-letter/:id/ignore (§15).
 */
import { NextRequest, NextResponse } from "next/server";
import { updateDeadLetterEvent, getDeadLetterById } from "@/modules/signals/persistence/dead-letter.repository";
import { authzErrorResponse, resolveResourceInOrg } from "@/lib/server/authz";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: dleId } = await params;

    const ctx = await resolveResourceInOrg({
      table: "dead_letter_events",
      resourceId: dleId,
      permission: "admin.jobs.view",
    });

    const { data: dle } = await getDeadLetterById(ctx.supabase, dleId);
    if (!dle) {
      return NextResponse.json(
        { ok: false, error: { code: "not_found", message: "Dead letter not found" } },
        { status: 404 }
      );
    }

    await updateDeadLetterEvent(ctx.supabase, dleId, {
      status: "ignored",
      resolution: "manual_ignore",
      resolved_at: new Date().toISOString(),
      resolved_by: ctx.user.id,
    });

    await ctx.supabase
      .from("raw_events")
      .update({
        processing_status: "processed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", dle.raw_event_id);

    return NextResponse.json({
      ok: true,
      data: { ignored: true },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
