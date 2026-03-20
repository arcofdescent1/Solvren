/**
 * Phase 10 — GET /api/playbooks/performance/:playbookKey (§18.4).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLatestPlaybookPerformance } from "@/modules/onboarding/repositories/playbook-performance-snapshots.repository";
import { getPlaybookDefinitionByKey } from "@/modules/autonomy/persistence/playbooks.repository";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ playbookKey: string }> }
) {
  const { playbookKey } = await params;
  if (!playbookKey) {
    return NextResponse.json({ error: "playbookKey required" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId) {
    return NextResponse.json({ error: "No active org" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: snapshots } = await getLatestPlaybookPerformance(admin, activeOrgId, { playbookKey });
  const { data: def } = await getPlaybookDefinitionByKey(supabase, playbookKey);

  const latest = snapshots[0];
  if (!latest) {
    return NextResponse.json({
      playbookKey,
      displayName: def?.display_name ?? playbookKey,
      healthState: "INSUFFICIENT_DATA",
      performanceScore: 0,
      recoveredAmount: 0,
      avoidedAmount: 0,
      savingsAmount: 0,
      runCount: 0,
      successCount: 0,
      failureCount: 0,
      partialSuccessCount: 0,
      verificationSuccessRate: null,
      automationRate: null,
      avgTimeToResolutionSeconds: null,
      trend: [],
    });
  }

  const { data: allForPlaybook } = await getLatestPlaybookPerformance(admin, activeOrgId, { playbookKey });
  const trend = allForPlaybook
    .slice(0, 10)
    .map((s) => ({
      windowEnd: s.snapshotWindowEnd,
      performanceScore: s.performanceScore,
      recoveredAmount: s.recoveredAmount,
      runCount: s.runCount,
    }));

  return NextResponse.json({
    playbookKey: latest.playbookKey,
    displayName: def?.display_name ?? latest.playbookKey,
    healthState: latest.healthState,
    performanceScore: latest.performanceScore,
    recoveredAmount: latest.recoveredAmount,
    avoidedAmount: latest.avoidedAmount,
    savingsAmount: latest.savingsAmount,
    runCount: latest.runCount,
    successCount: latest.successCount,
    failureCount: latest.failureCount,
    partialSuccessCount: latest.partialSuccessCount,
    verificationSuccessRate: latest.verificationSuccessRate,
    automationRate: latest.automationRate,
    avgTimeToResolutionSeconds: latest.avgTimeToResolutionSeconds,
    reasons: latest.reasonsJson,
    trend,
  });
}
