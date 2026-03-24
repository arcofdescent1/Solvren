/**
 * Phase 3 — POST /api/admin/dead-letter/:id/retry (§15).
 */
import { NextRequest, NextResponse } from "next/server";
import { getRawEventById } from "@/modules/signals/persistence/raw-events.repository";
import { processRawEvent } from "@/modules/signals/processing/signal-processor.service";
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

    const { data: rawEvent } = await getRawEventById(ctx.supabase, dle.raw_event_id);
    if (!rawEvent) {
      return NextResponse.json(
        { ok: false, error: { code: "not_found", message: "Raw event not found" } },
        { status: 404 }
      );
    }

    await ctx.supabase
      .from("raw_events")
      .update({
        processing_status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", rawEvent.id);

    const result = await processRawEvent(ctx.supabase, rawEvent);
    await updateDeadLetterEvent(ctx.supabase, dleId, {
      retry_count: dle.retry_count + 1,
      last_retry_at: new Date().toISOString(),
      status: result.ok ? "resolved" : "pending",
      resolution: result.ok ? "retry_succeeded" : null,
      resolved_at: result.ok ? new Date().toISOString() : null,
      resolved_by: result.ok ? ctx.user.id : null,
    });

    return NextResponse.json({
      ok: true,
      data: { success: result.ok, signalId: result.ok ? result.signalId : null },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
