/**
 * Phase 10 — GET /api/playbooks/performance (§18.3).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { getLatestPlaybookPerformance } from "@/modules/onboarding/repositories/playbook-performance-snapshots.repository";
import { getOrgPlaybookConfigs } from "@/modules/autonomy/persistence/playbooks.repository";
import { listPlaybookDefinitions } from "@/modules/autonomy/persistence/playbooks.repository";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId) {
    return NextResponse.json({ error: "No active org" }, { status: 400 });
  }

  const { data: snapshots } = await getLatestPlaybookPerformance(supabase, activeOrgId);
  const { data: configs } = await getOrgPlaybookConfigs(supabase, activeOrgId);
  const { data: definitions } = await listPlaybookDefinitions(supabase);

  const enabledConfigs = (configs ?? []).filter((c) => c.enabled);
  const defById = new Map((definitions ?? []).map((d) => [d.id, d]));

  const playbooks = enabledConfigs.map((config) => {
    const def = defById.get(config.playbook_definition_id);
    const snap = snapshots.find((s) => s.playbookKey === def?.playbook_key);
    return {
      playbookKey: def?.playbook_key ?? "unknown",
      displayName: def?.display_name ?? "Unknown",
      healthState: snap?.healthState ?? "INSUFFICIENT_DATA",
      performanceScore: snap?.performanceScore ?? 0,
      recoveredAmount: snap?.recoveredAmount ?? 0,
      avoidedAmount: snap?.avoidedAmount ?? 0,
      savingsAmount: snap?.savingsAmount ?? 0,
      runCount: snap?.runCount ?? 0,
      verificationSuccessRate: snap?.verificationSuccessRate ?? null,
      automationRate: snap?.automationRate ?? null,
      lastActivity: snap?.snapshotWindowEnd ?? null,
    };
  });

  return NextResponse.json({ playbooks });
}
