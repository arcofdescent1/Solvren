/**
 * Guided Phase 1 — poll baseline scan; lazily completes QUEUED/RUNNING runs.
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { getScanRunById } from "@/modules/onboarding/repositories/org-onboarding-scan-runs.repository";
import {
  failBaselineScanRun,
  tryProcessBaselineScanRun,
} from "@/modules/onboarding/services/onboarding-baseline-scan.service";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId) return NextResponse.json({ error: "No active org" }, { status: 400 });

  const { data: run, error } = await getScanRunById(supabase, id, activeOrgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!run) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (run.status === "QUEUED" || run.status === "RUNNING") {
    try {
      await tryProcessBaselineScanRun(id, activeOrgId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "scan_failed";
      await failBaselineScanRun(id, activeOrgId, msg);
    }
  }

  const { data: fresh } = await getScanRunById(supabase, id, activeOrgId);
  if (!fresh) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({
    id: fresh.id,
    status: fresh.status,
    sourceMode: fresh.source_mode,
    issueCount: fresh.issue_count,
    estimatedRevenueAtRisk: fresh.estimated_revenue_at_risk != null ? Number(fresh.estimated_revenue_at_risk) : null,
    findings: fresh.findings,
    errorMessage: fresh.error_message,
  });
}
