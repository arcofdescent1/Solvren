/**
 * Guided Phase 1 — enqueue baseline scan run.
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { getOrgOnboardingState, upsertOrgOnboardingState } from "@/modules/onboarding/repositories/org-onboarding-states.repository";
import { findActiveScanRunForOrg, insertScanRun } from "@/modules/onboarding/repositories/org-onboarding-scan-runs.repository";
import { getAccountsByOrg } from "@/modules/integrations/core/integrationAccountsRepo";

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId) return NextResponse.json({ error: "No active org" }, { status: 400 });

  const { data: row } = await getOrgOnboardingState(supabase, activeOrgId);
  if (!row) return NextResponse.json({ error: "onboarding_not_initialized" }, { status: 400 });

  const useCases = parseStringArray(row.selected_use_cases);
  if (useCases.length < 1) return NextResponse.json({ error: "use_cases_required" }, { status: 400 });

  const { data: active } = await findActiveScanRunForOrg(supabase, activeOrgId);
  if (active?.id) {
    return NextResponse.json({ scanId: active.id, status: active.status, reused: true });
  }

  const { data: accounts } = await getAccountsByOrg(supabase, activeOrgId);
  const connected = (accounts ?? [])
    .filter((a) => a.status === "connected" || a.status === "connected_limited" || a.status === "syncing")
    .map((a) => a.provider);

  const { data: created, error } = await insertScanRun(supabase, {
    orgId: activeOrgId,
    userId: userRes.user.id,
    selectedUseCases: useCases,
    connectedIntegrations: connected,
    status: "QUEUED",
    sourceMode: "REAL",
  });
  if (error || !created) return NextResponse.json({ error: error?.message ?? "insert_failed" }, { status: 500 });

  const { error: upErr } = await upsertOrgOnboardingState(supabase, {
    orgId: activeOrgId,
    latestBaselineScanId: created.id,
    guidedCurrentStepKey: "baseline_scan",
  });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({ scanId: created.id, status: created.status });
}
