/**
 * Phase 9 — PUT /api/admin/autonomy/mode (§17.2).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { upsertAutonomyModeConfig } from "@/modules/autonomy-safety/repositories/autonomy-mode-configs.repository";
import { ExecutionMode } from "@/modules/autonomy-safety/domain";

type Body = {
  scopeType: string;
  scopeRef?: string | null;
  requestedMode: string;
};

export async function PUT(req: NextRequest) {
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

  if (!body.scopeType || typeof body.scopeType !== "string") {
    return NextResponse.json({ error: "scopeType required" }, { status: 400 });
  }
  if (!body.requestedMode || typeof body.requestedMode !== "string") {
    return NextResponse.json({ error: "requestedMode required" }, { status: 400 });
  }

  const validModes = Object.values(ExecutionMode);
  if (!validModes.includes(body.requestedMode as ExecutionMode)) {
    return NextResponse.json({ error: "Invalid requestedMode" }, { status: 400 });
  }

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId) {
    return NextResponse.json({ error: "No active org" }, { status: 400 });
  }

  const { error } = await upsertAutonomyModeConfig(supabase, {
    orgId: activeOrgId,
    scopeType: body.scopeType,
    scopeRef: body.scopeRef ?? null,
    requestedMode: body.requestedMode as ExecutionMode,
    createdByUserId: userRes.user.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
