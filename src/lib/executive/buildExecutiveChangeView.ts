import type { SupabaseClient } from "@supabase/supabase-js";
import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { evaluateEvidenceStatus } from "@/services/evidence";
import { getAttentionSummary } from "./attentionSummary";
import { computeExecutiveConfidence, confidenceLabel } from "./confidenceScore";
import { deriveExecutiveOverlayState, type DecisionRow } from "./executiveOverlayState";
import {
  departmentsFromDomain,
  formatCustomersAffected,
  formatRevenueAtRisk,
  systemsFromSurface,
  truncateList,
} from "./exposureFormatting";
import { getExecutiveRecommendation } from "./recommendation";
import { deriveReadinessRows } from "./readinessDerivation";
import { normalizeRiskLevel } from "./riskLevel";
import type { ExecutiveChangeView, SignoffSummary } from "./types";
import { buildSlackPrimaryConcern } from "./slackPrimaryConcern";

function domainToChangeType(domain: string | null | undefined): string {
  const d = String(domain ?? "General").replace(/_/g, " ");
  return d.charAt(0).toUpperCase() + d.slice(1).toLowerCase();
}

function buildSignoffs(
  approvals: Array<{ approval_area: string | null; decision: string | null }>
): SignoffSummary {
  const approved: string[] = [];
  const pending: string[] = [];
  const rejected: string[] = [];
  for (const a of approvals) {
    const label = String(a.approval_area ?? "Reviewer").trim() || "Reviewer";
    if (a.decision === "APPROVED") approved.push(label);
    else if (a.decision === "REJECTED") rejected.push(label);
    else if (a.decision === "PENDING") pending.push(label);
  }
  return { approved, pending, rejected };
}

function detectConflict(signoffs: SignoffSummary): { conflict: boolean; message: string | null } {
  if (signoffs.approved.length > 0 && signoffs.rejected.length > 0) {
    return {
      conflict: true,
      message: `Conflict: ${signoffs.approved.slice(0, 2).join(", ")} approved while ${signoffs.rejected.slice(0, 2).join(", ")} rejected.`,
    };
  }
  return { conflict: false, message: null };
}

/**
 * Single aggregation entry point for executive page + executive Slack DM (build from this output).
 */
export async function buildExecutiveChangeView(
  supabase: SupabaseClient,
  changeId: string
): Promise<ExecutiveChangeView | null> {
  const { data: change, error: ceErr } = await scopeActiveChangeEvents(
    supabase
      .from("change_events")
      .select(
        "id, org_id, title, status, domain, due_at, revenue_at_risk, revenue_surface, estimated_mrr_affected, percent_customer_base_affected, customers_affected_count"
      )
  )
    .eq("id", changeId)
    .maybeSingle();

  if (ceErr || !change) return null;

  const orgId = change.org_id as string;
  const title = String((change as { title?: string }).title ?? "Untitled change");
  const domain = (change as { domain?: string | null }).domain ?? null;

  const [{ data: settings }, { data: latestAssessment }, { data: approvals }, { data: execDecisions }, { data: incidents }, { data: signals }, { data: coord }, { data: audits }] =
    await Promise.all([
      supabase
        .from("organization_settings")
        .select("executive_revenue_escalation_threshold_usd")
        .eq("org_id", orgId)
        .maybeSingle(),
      supabase
        .from("impact_assessments")
        .select("risk_bucket")
        .eq("change_event_id", changeId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("approvals")
        .select("approval_area, decision, decided_at")
        .eq("change_event_id", changeId),
      supabase
        .from("executive_change_decisions")
        .select("decision, created_at")
        .eq("change_id", changeId)
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("incidents").select("id, status").eq("change_event_id", changeId),
      supabase.from("risk_signals").select("signal_key").eq("change_event_id", changeId).limit(40),
      supabase
        .from("coordination_plans")
        .select("plan_json")
        .eq("change_id", changeId)
        .eq("is_current", true)
        .maybeSingle(),
      supabase
        .from("audit_log")
        .select("action, created_at")
        .eq("change_event_id", changeId)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

  const thresholdRaw = (settings as { executive_revenue_escalation_threshold_usd?: number | null } | null)
    ?.executive_revenue_escalation_threshold_usd;
  const revenueEscalationThresholdUsd =
    thresholdRaw != null && Number.isFinite(Number(thresholdRaw)) ? Number(thresholdRaw) : 100_000;

  const riskLevel = normalizeRiskLevel((latestAssessment as { risk_bucket?: string } | null)?.risk_bucket);

  const evidenceKinds = new Set<string>();
  try {
    const ev = await evaluateEvidenceStatus(supabase, changeId);
    for (const item of ev.items) {
      if (item.status === "PROVIDED" || item.status === "WAIVED") {
        evidenceKinds.add(String(item.kind ?? "").toUpperCase());
      }
    }
  } catch {
    const { data: legacyEv } = await supabase.from("change_evidence").select("kind").eq("change_event_id", changeId);
    for (const e of legacyEv ?? []) {
      evidenceKinds.add(String((e as { kind?: string }).kind ?? "").toUpperCase());
    }
  }

  const blockers =
    (coord?.plan_json as { blockers?: Array<{ severity?: string; title?: string }> } | null)?.blockers ?? [];
  const coordinationBlockers = blockers.map((b) => ({
    title: String(b.title ?? "Blocker"),
    severity: b.severity,
  }));

  const readiness = deriveReadinessRows({
    approvals: (approvals ?? []) as { approval_area: string | null; decision: string | null; decided_at?: string | null }[],
    evidenceKinds,
    coordinationBlockers,
  });

  const signoffs = buildSignoffs((approvals ?? []) as { approval_area: string | null; decision: string | null }[]);
  const { conflict: hasApprovalConflict, message: approvalConflictMessage } = detectConflict(signoffs);

  const hasBlockedReadiness = readiness.some((r) => r.status === "BLOCKED");
  const hasCriticalPendingReadiness = readiness.some(
    (r) =>
      r.status === "PENDING" &&
      (r.category === "Support" || r.category === "Finance" || r.category === "Rollback Plan")
  );

  const openIncidents = (incidents ?? []).filter(
    (i: { status?: string | null }) => String(i.status ?? "").toUpperCase() !== "RESOLVED"
  );
  const hasOpenIncidents = openIncidents.length > 0;

  const coordErrors = coordinationBlockers.filter((b) => String(b.severity ?? "") === "ERROR");

  const revRaw = (change as { revenue_at_risk?: number | null }).revenue_at_risk;
  const revenueAtRisk = revRaw != null && Number.isFinite(Number(revRaw)) ? Number(revRaw) : null;
  const hasMrr =
    (change as { estimated_mrr_affected?: number | null }).estimated_mrr_affected != null &&
    Number((change as { estimated_mrr_affected?: number | null }).estimated_mrr_affected) > 0;
  const revenueAtRiskPeriod: "MONTHLY" | "ONE_TIME" = hasMrr ? "MONTHLY" : "MONTHLY";

  const recommendation = getExecutiveRecommendation({
    riskLevel,
    readiness,
    hasApprovalConflict,
    revenueAtRiskMonthly: revenueAtRisk,
    revenueThresholdUsd: revenueEscalationThresholdUsd,
    hasBlockedReadiness,
    hasCriticalPendingReadiness,
    hasOpenIncidents,
    hasCoordinationErrors: coordErrors.length > 0,
  });

  const rollbackReady = readiness.find((r) => r.category === "Rollback Plan")?.status === "READY";
  const monitoringReady =
    readiness.find((r) => r.category === "Monitoring / Alerting")?.status === "READY";

  const confidenceScore = computeExecutiveConfidence({
    readiness,
    signoffs,
    hasApprovalConflict,
    hasOpenIncidents,
    hasRollbackReady: !!rollbackReady,
    hasMonitoringReady: !!monitoringReady,
    riskLevel,
  });

  const customersAffected =
    (change as { customers_affected_count?: number | null }).customers_affected_count != null
      ? Number((change as { customers_affected_count?: number | null }).customers_affected_count)
      : null;

  const departments = departmentsFromDomain(domain);
  const systems = systemsFromSurface((change as { revenue_surface?: string | null }).revenue_surface);

  const overlay = deriveExecutiveOverlayState((execDecisions ?? []) as DecisionRow[]);

  const viewBase: ExecutiveChangeView = {
    id: changeId,
    title,
    changeType: domainToChangeType(domain),
    status: String((change as { status?: string }).status ?? "—"),
    riskLevel,
    recommendation,
    confidenceScore,
    confidenceLabel: confidenceLabel(confidenceScore),
    scheduledAt: (change as { due_at?: string | null }).due_at ?? null,
    revenueAtRisk,
    revenueAtRiskPeriod,
    displayRevenueAtRisk: formatRevenueAtRisk(revenueAtRisk, revenueAtRiskPeriod),
    customersAffected,
    customersAffectedDisplay: formatCustomersAffected(customersAffected),
    departmentsAffected: departments,
    systemsAffected: systems,
    readiness,
    signoffs,
    attentionSummary: [],
    hasApprovalConflict,
    approvalConflictMessage,
    executiveOverlay: overlay,
    technicalDetails: {
      signals: (signals ?? []).map((s: { signal_key?: string }) => ({
        key: String(s.signal_key ?? "signal"),
      })),
      policyViolations: [],
      incidents: openIncidents.map((i: { id: string; status?: string | null }) => ({
        id: i.id,
        status: i.status ?? null,
      })),
      notes: (audits ?? []).map((a: { action?: string; created_at?: string }) => ({
        action: String(a.action ?? "event"),
        at: String(a.created_at ?? ""),
      })),
    },
    slackPrimaryConcern: { primary: "", moreCount: 0 },
    revenueEscalationThresholdUsd,
    hasRiskAssessment: !!(latestAssessment as { risk_bucket?: string } | null)?.risk_bucket,
  };

  viewBase.attentionSummary = getAttentionSummary(viewBase);

  viewBase.slackPrimaryConcern = buildSlackPrimaryConcern(viewBase);

  return viewBase;
}

export function formatDepartmentSystemLists(view: ExecutiveChangeView): {
  departmentsLine: string;
  systemsLine: string;
} {
  const d = truncateList(view.departmentsAffected, 4);
  const s = truncateList(view.systemsAffected, 4);
  return {
    departmentsLine:
      d.visible.join(", ") + (d.more > 0 ? ` +${d.more} more` : ""),
    systemsLine: s.visible.join(", ") + (s.more > 0 ? ` +${s.more} more` : ""),
  };
}
