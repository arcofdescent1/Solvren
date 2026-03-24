/**
 * Phase 9 — DELETE /api/admin/autonomy/pause/:pauseId (§17.4).
 */
import { NextRequest, NextResponse } from "next/server";
import { clearPauseControl } from "@/modules/autonomy-safety/repositories/autonomy-pause-controls.repository";
import { authzErrorResponse, resolveResourceInOrg } from "@/lib/server/authz";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ pauseId: string }> }
) {
  try {
    const { pauseId } = await params;
    if (!pauseId) {
      return NextResponse.json({ error: "pauseId required" }, { status: 400 });
    }

    const ctx = await resolveResourceInOrg({
      table: "autonomy_pause_controls",
      resourceId: pauseId,
      permission: "admin.simulations.manage",
    });

    const { error } = await clearPauseControl(ctx.supabase, pauseId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
