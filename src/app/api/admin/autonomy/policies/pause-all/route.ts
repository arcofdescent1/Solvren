/**
 * Phase 8 — POST /api/admin/autonomy/policies/pause-all.
 */
import { NextRequest, NextResponse } from "next/server";
import { setAutomationPaused } from "@/modules/autonomy/persistence/policies.repository";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAnyOrgPermission("admin.simulations.manage");

    let body: { pause: boolean; reason?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { error } = await setAutomationPaused(
      ctx.supabase,
      ctx.orgId,
      body.pause ?? true,
      ctx.user.id,
      body.reason
    );

    if (error) return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    return NextResponse.json({ ok: true, paused: body.pause ?? true });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
