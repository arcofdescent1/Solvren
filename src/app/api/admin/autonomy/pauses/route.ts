/**
 * Phase 9 — GET /api/admin/autonomy/pauses (for AutomationPauseBanner).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { listActivePauseControls } from "@/modules/autonomy-safety/repositories/autonomy-pause-controls.repository";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url ?? "", "http://localhost");
  let orgId = searchParams.get("orgId");
  if (!orgId) {
    const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
    orgId = activeOrgId ?? null;
  }
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  const { data: rows, error } = await listActivePauseControls(supabase, orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const pauses = (rows ?? []).map((r) => ({
    id: r.id,
    pauseType: r.pause_type,
    reason: r.reason,
    scopeType: r.scope_type,
    scopeRef: r.scope_ref,
  }));

  return NextResponse.json({ pauses });
}
