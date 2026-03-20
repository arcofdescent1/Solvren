/**
 * Phase 8 — POST /api/demo/reset (§21.3).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { resetDemoOrg } from "@/modules/demo/services/demo-reset.service";

type Body = {
  orgId?: string;
  resetMode?: "full" | "scenario_only" | "data_refresh";
  scenarioKey: string;
};

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.scenarioKey || typeof body.scenarioKey !== "string") {
    return NextResponse.json({ error: "scenarioKey required" }, { status: 400 });
  }

  let orgId = body.orgId;
  if (!orgId) {
    const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
    orgId = activeOrgId ?? undefined;
  }
  if (!orgId) {
    return NextResponse.json({ error: "orgId required (or set active org)" }, { status: 400 });
  }

  const admin = createAdminClient();
  const result = await resetDemoOrg(admin, {
    orgId,
    scenarioKey: body.scenarioKey,
    resetMode: body.resetMode ?? "full",
    requestedByUserId: userRes.user.id,
  });

  if (result.status === "failed") {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    status: result.status,
    scenarioKey: body.scenarioKey,
  });
}
