/**
 * Phase 9 — GET /api/autonomy/state (§17.1).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { resolveExecutionMode } from "@/modules/autonomy-safety/services/execution-mode-resolver.service";
import type { AppEnvironment } from "@/modules/autonomy-safety/domain";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url ?? "", "http://localhost");
  const orgId = searchParams.get("orgId");
  const issueId = searchParams.get("issueId") ?? undefined;
  const workflowRunId = searchParams.get("workflowRunId") ?? undefined;
  const actionKey = searchParams.get("actionKey") ?? undefined;
  const playbookKey = searchParams.get("playbookKey") ?? undefined;
  const environment = (searchParams.get("environment") ?? "production") as AppEnvironment;

  let resolvedOrgId = orgId;
  if (!resolvedOrgId) {
    const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
    resolvedOrgId = activeOrgId ?? undefined;
  }
  if (!resolvedOrgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  const { data, error } = await resolveExecutionMode(supabase, {
    orgId: resolvedOrgId,
    environment,
    issueId: issueId || null,
    workflowRunId: workflowRunId || null,
    actionKey: actionKey || null,
    playbookKey: playbookKey || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Could not resolve autonomy state" }, { status: 500 });

  return NextResponse.json({
    requestedMode: data.requestedMode,
    effectiveMode: data.effectiveMode,
    autonomyConfidenceScore: data.autonomyConfidenceScore,
    autonomyConfidenceBand: data.autonomyConfidenceBand,
    downgradeReasonCodes: data.downgradeReasonCodes,
    pauseReasonCodes: data.pauseReasonCodes,
  });
}
