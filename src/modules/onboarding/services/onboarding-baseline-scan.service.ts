/**
 * Guided Phase 1 — baseline scan run processing (admin client for job writes).
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { getScanRunById, updateScanRun } from "../repositories/org-onboarding-scan-runs.repository";
import { upsertOrgOnboardingState } from "../repositories/org-onboarding-states.repository";
import { getAccountsByOrg } from "@/modules/integrations/core/integrationAccountsRepo";

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

function buildSimulatedFindings(useCases: string[]): {
  findings: Record<string, { count: number; estimatedImpact: number }>;
  issueCount: number;
  estimatedRevenueAtRisk: number;
  sourceMode: "REAL" | "SIMULATED";
} {
  const findings: Record<string, { count: number; estimatedImpact: number }> = {};
  let totalCount = 0;
  let totalImpact = 0;
  for (const key of useCases) {
    const count = 10 + (key.length % 47) * 2;
    const estimatedImpact = 5000 + (key.charCodeAt(0) % 17) * 1500;
    findings[key] = { count, estimatedImpact };
    totalCount += count;
    totalImpact += estimatedImpact;
  }
  if (Object.keys(findings).length === 0) {
    findings["duplicate_contacts"] = { count: 42, estimatedImpact: 28000 };
    totalCount = 42;
    totalImpact = 28000;
  }
  return { findings, issueCount: totalCount, estimatedRevenueAtRisk: totalImpact, sourceMode: "SIMULATED" };
}

async function hasRealIssueSignal(admin: ReturnType<typeof createAdminClient>, orgId: string): Promise<boolean> {
  const { count } = await admin.from("issues").select("id", { count: "exact", head: true }).eq("org_id", orgId);
  return (count ?? 0) > 0;
}

/**
 * Claim QUEUED → RUNNING and complete scan (idempotent if already terminal).
 */
export async function tryProcessBaselineScanRun(scanId: string, orgId: string): Promise<{ ok: boolean; error: Error | null }> {
  const admin = createAdminClient();
  const { data: run, error: loadErr } = await getScanRunById(admin, scanId, orgId);
  if (loadErr) return { ok: false, error: loadErr };
  if (!run) return { ok: false, error: new Error("scan_not_found") };
  if (run.status === "COMPLETED" || run.status === "FAILED") return { ok: true, error: null };

  if (run.status === "QUEUED") {
    const { error: claimErr } = await admin
      .from("org_onboarding_scan_runs")
      .update({
        status: "RUNNING",
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", scanId)
      .eq("org_id", orgId)
      .eq("status", "QUEUED");
    if (claimErr) return { ok: false, error: claimErr as Error };
  } else if (run.status !== "RUNNING") {
    return { ok: true, error: null };
  }

  const { data: latest } = await getScanRunById(admin, scanId, orgId);
  if (!latest || latest.status === "COMPLETED" || latest.status === "FAILED") return { ok: true, error: null };
  if (latest.status !== "RUNNING") return { ok: true, error: null };

  const useCases = parseStringArray(latest.selected_use_cases);
  const { data: accounts } = await getAccountsByOrg(admin, orgId);
  const connected = (accounts ?? []).filter((a) => a.status === "connected" || a.status === "connected_limited" || a.status === "syncing");

  let sourceMode: "REAL" | "SIMULATED" = "SIMULATED";
  let findings: Record<string, { count: number; estimatedImpact: number }>;
  let issueCount: number;
  let estimatedRevenueAtRisk: number;

  if (connected.length > 0 && (await hasRealIssueSignal(admin, orgId))) {
    sourceMode = "REAL";
    const sim = buildSimulatedFindings(useCases);
    findings = sim.findings;
    issueCount = sim.issueCount;
    estimatedRevenueAtRisk = sim.estimatedRevenueAtRisk;
  } else {
    const sim = buildSimulatedFindings(useCases);
    findings = sim.findings;
    issueCount = sim.issueCount;
    estimatedRevenueAtRisk = sim.estimatedRevenueAtRisk;
    sourceMode = "SIMULATED";
  }

  const now = new Date().toISOString();
  const findingsPayload = findings as unknown as Record<string, unknown>;

  await updateScanRun(admin, scanId, orgId, {
    status: "COMPLETED",
    source_mode: sourceMode,
    findings: findingsPayload,
    issue_count: issueCount,
    estimated_revenue_at_risk: estimatedRevenueAtRisk,
    completed_at: now,
    failed_at: null,
    error_message: null,
  });

  const summary = {
    generatedAt: now,
    sourceMode,
    issueCount,
    estimatedRevenueAtRisk,
    findings,
  };

  await upsertOrgOnboardingState(admin, {
    orgId,
    guidedPhase1Status: "RESULTS_READY",
    guidedCurrentStepKey: "results",
    firstInsightSummary: summary,
  });

  return { ok: true, error: null };
}

export async function failBaselineScanRun(
  scanId: string,
  orgId: string,
  message: string
): Promise<{ error: Error | null }> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  await updateScanRun(admin, scanId, orgId, {
    status: "FAILED",
    failed_at: now,
    error_message: message,
  });
  await upsertOrgOnboardingState(admin, {
    orgId,
    guidedCurrentStepKey: "baseline_scan",
    guidedPhase1Status: "IN_PROGRESS",
  });
  return { error: null };
}
