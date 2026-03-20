/**
 * Phase 3 — POST /api/admin/signals/replay (§15).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { runReplay } from "@/modules/signals/processing/replay.service";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "Unauthorized" } }, { status: 401 });
  }

  let body: { orgId: string; provider?: string; signalKey?: string; timeFrom?: string; timeTo?: string; rawEventIds?: string[]; limit?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = { orgId: "" };
  }
  if (!body.orgId) {
    return NextResponse.json({ ok: false, error: { code: "bad_request", message: "orgId required" } }, { status: 400 });
  }

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", body.orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  const { isAdminLikeRole, parseOrgRole } = await import("@/lib/rbac/roles");
  if (!member || !isAdminLikeRole(parseOrgRole((member as { role: string | null }).role ?? null))) {
    return NextResponse.json({ ok: false, error: { code: "forbidden", message: "Forbidden" } }, { status: 403 });
  }

  const admin = createAdminClient();
  const result = await runReplay(admin, {
    orgId: body.orgId,
    requestedBy: userRes.user.id,
    provider: body.provider,
    signalKey: body.signalKey,
    timeFrom: body.timeFrom,
    timeTo: body.timeTo,
    rawEventIds: body.rawEventIds,
    limit: body.limit,
  });

  return NextResponse.json({
    ok: true,
    data: result,
    meta: { timestamp: new Date().toISOString() },
  });
}
