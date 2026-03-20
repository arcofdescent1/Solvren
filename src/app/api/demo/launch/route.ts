/**
 * Phase 8 — POST /api/demo/launch (§16.3, §21.2).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { launchDemoScenario } from "@/modules/demo/services/demo-scenario-launcher.service";

type Body = {
  orgId?: string;
  scenarioKey: string;
  seedVersion?: string;
  resetBeforeLaunch?: boolean;
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
  const result = await launchDemoScenario(admin, {
    orgId,
    scenarioKey: body.scenarioKey,
    seedVersion: body.seedVersion,
    resetBeforeLaunch: body.resetBeforeLaunch !== false,
  });

  if (result.status === "failed") {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    status: "queued",
    scenarioKey: result.scenarioKey,
  });
}
