/**
 * Gap 5: Executive metrics calculation with provenance.
 * Revenue Exposure = SUM(impact_amount) WHERE approved_at IS NULL (open).
 * Governance Coverage = Approved / Total risk events (in window).
 */

import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import type { SupabaseClient } from "@supabase/supabase-js";
import { auditLog } from "@/lib/audit";

const CALCULATION_VERSION = "v1";

export type ExecutiveMetrics = {
  revenueExposure: number;
  unapprovedChanges: number;
  governanceCoverage: number;
  openRiskEvents: number;
};

export type MetricProvenance = {
  revenueExposure: { sourceEventIds: string[]; formula: string };
  unapprovedChanges: { count: number; formula: string };
  governanceCoverage: { approved: number; total: number; formula: string };
  openRiskEvents: { sourceEventIds: string[]; count: number; formula: string };
};

/** Default window: last 7 days for risk-based metrics. */
function defaultSince(): Date {
  const since = new Date();
  since.setDate(since.getDate() - 7);
  return since;
}

export async function computeExecutiveMetrics(
  supabase: SupabaseClient,
  orgId: string,
  options?: { since?: Date; storeProvenance?: boolean; actorId?: string | null }
): Promise<{ metrics: ExecutiveMetrics; provenance: MetricProvenance }> {
  const since = options?.since ?? defaultSince();
  const sinceIso = since.toISOString();

  const { data: riskRows } = await supabase
    .from("risk_events")
    .select("id, impact_amount, approved_at")
    .eq("org_id", orgId)
    .gte("timestamp", sinceIso);

  const events = riskRows ?? [];
  const openEvents = events.filter((e) => !e.approved_at);
  const sourceEventIds = openEvents.map((e) => e.id);
  const revenueExposure = openEvents.reduce((sum, e) => sum + (Number(e.impact_amount) || 0), 0);
  const openRiskEvents = openEvents.length;
  const approvedCount = events.length - openEvents.length;
  const governanceCoverage =
    events.length > 0 ? Math.round((approvedCount / events.length) * 100) : 100;

  const { data: inReviewRows } = await scopeActiveChangeEvents(supabase.from("change_events").select("id, org_id, domain, status, created_by, is_restricted"))
    .eq("org_id", orgId)
    .eq("status", "IN_REVIEW");

  const unapprovedChanges = (inReviewRows ?? []).length;

  const provenance: MetricProvenance = {
    revenueExposure: {
      sourceEventIds,
      formula: "Sum of estimated impacts across open risk events (approved_at is null).",
    },
    unapprovedChanges: {
      count: unapprovedChanges,
      formula: "Count of change requests with status IN_REVIEW.",
    },
    governanceCoverage: {
      approved: approvedCount,
      total: events.length,
      formula: "Approved risk events / Total detected risk events in window.",
    },
    openRiskEvents: {
      sourceEventIds,
      count: openRiskEvents,
      formula: "Count of risk events with no approval (open).",
    },
  };

  const metrics: ExecutiveMetrics = {
    revenueExposure: Math.round(revenueExposure),
    unapprovedChanges,
    governanceCoverage,
    openRiskEvents,
  };

  if (options?.storeProvenance) {
    const ts = new Date().toISOString();
    await supabase.from("metric_provenance").insert([
      {
        organization_id: orgId,
        metric_name: "revenue_exposure",
        metric_value: metrics.revenueExposure,
        calculation_timestamp: ts,
        source_event_ids: sourceEventIds,
        calculation_version: CALCULATION_VERSION,
      },
      {
        organization_id: orgId,
        metric_name: "unapproved_changes",
        metric_value: metrics.unapprovedChanges,
        calculation_timestamp: ts,
        source_event_ids: [],
        calculation_version: CALCULATION_VERSION,
      },
      {
        organization_id: orgId,
        metric_name: "governance_coverage",
        metric_value: metrics.governanceCoverage,
        calculation_timestamp: ts,
        source_event_ids: [],
        calculation_version: CALCULATION_VERSION,
      },
      {
        organization_id: orgId,
        metric_name: "open_risk_events",
        metric_value: metrics.openRiskEvents,
        calculation_timestamp: ts,
        source_event_ids: sourceEventIds,
        calculation_version: CALCULATION_VERSION,
      },
    ]);

    await auditLog(supabase, {
      orgId,
      actorId: options?.actorId ?? null,
      actorType: "SYSTEM",
      action: "metric_calculated",
      entityType: "metric",
      entityId: "executive",
      metadata: {
        metric: "revenue_exposure",
        value: metrics.revenueExposure,
        source_events: sourceEventIds.slice(0, 50),
        calculation_version: CALCULATION_VERSION,
      },
    });
  }

  return { metrics, provenance };
}

export async function storeMetricSnapshots(
  supabase: SupabaseClient,
  orgId: string,
  metrics: ExecutiveMetrics,
  snapshotTime: Date
): Promise<void> {
  const t = snapshotTime.toISOString();
  await supabase.from("metric_snapshots").insert([
    { organization_id: orgId, metric_name: "revenue_exposure", metric_value: metrics.revenueExposure, snapshot_time: t, calculation_version: CALCULATION_VERSION },
    { organization_id: orgId, metric_name: "unapproved_changes", metric_value: metrics.unapprovedChanges, snapshot_time: t, calculation_version: CALCULATION_VERSION },
    { organization_id: orgId, metric_name: "governance_coverage", metric_value: metrics.governanceCoverage, snapshot_time: t, calculation_version: CALCULATION_VERSION },
    { organization_id: orgId, metric_name: "open_risk_events", metric_value: metrics.openRiskEvents, snapshot_time: t, calculation_version: CALCULATION_VERSION },
  ]);
}
