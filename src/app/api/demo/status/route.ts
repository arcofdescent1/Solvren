/**
 * Phase 8 — GET /api/demo/status (§21.4).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { getOrgDemoConfig } from "@/modules/demo/repositories/org-demo-config.repository";
import { getLatestDemoOrgReset } from "@/modules/demo/repositories/demo-org-resets.repository";

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
    return NextResponse.json({ error: "orgId required (or set active org)" }, { status: 400 });
  }

  const { data: config, error: configErr } = await getOrgDemoConfig(supabase, orgId);
  if (configErr) return NextResponse.json({ error: configErr.message }, { status: 500 });

  if (!config || !config.isDemoOrg) {
    return NextResponse.json({
      orgId,
      isDemoOrg: false,
      scenarioKey: null,
      seedVersion: null,
      lastResetAt: null,
      validationStatus: null,
    });
  }

  const { data: lastReset } = await getLatestDemoOrgReset(supabase, orgId);

  return NextResponse.json({
    orgId,
    isDemoOrg: true,
    scenarioKey: config.demoScenarioKey ?? null,
    seedVersion: lastReset?.seedVersion ?? null,
    lastResetAt: config.lastResetAt ?? null,
    validationStatus: config.validationStatus ?? "unknown",
  });
}
