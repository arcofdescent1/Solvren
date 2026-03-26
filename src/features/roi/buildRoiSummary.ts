/**
 * Shared ROI summary builder — single source for GET /api/insights/roi-summary and Home impact signal.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import type { RoiConfidence, RoiMetric, RoiStoryCard, RoiSummaryResponse } from "@/features/roi/types";
import { computeImpactBoundary, confidenceRank, qualifiesLikelyPrevented } from "@/features/roi/attribution";

export type RoiRangeKey = "7d" | "30d" | "90d";

type ChangeRow = {
  id: string;
  title: string | null;
  status: string | null;
  submitted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  due_at: string | null;
  sla_status: string | null;
  estimated_mrr_affected: number | null;
};

type LatestRisk = { risk_bucket: string | null; risk_score_raw: number | null };

export function parseRoiRangeParam(raw: string | null): { range: RoiRangeKey; days: number } {
  if (raw === "7d") return { range: "7d", days: 7 };
  if (raw === "90d") return { range: "90d", days: 90 };
  return { range: "30d", days: 30 };
}

function fmtPct(v: number) {
  return `${Math.round(v)}%`;
}

function fmtNumber(v: number) {
  return new Intl.NumberFormat("en-US").format(v);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[half - 1] + sorted[half]) / 2 : sorted[half];
}

function buildMetric(args: {
  key: string;
  label: string;
  value: number;
  displayValue: string;
  confidence: RoiConfidence;
  valueStatement: string;
  howDetermined: string;
}): RoiMetric {
  return { ...args };
}

/**
 * Computes the same payload as GET /api/insights/roi-summary for the given org and window.
 */
function rangeToDays(range: RoiRangeKey): number {
  if (range === "7d") return 7;
  if (range === "90d") return 90;
  return 30;
}

export async function buildRoiSummary(
  supabase: SupabaseClient,
  orgId: string,
  range: RoiRangeKey
): Promise<RoiSummaryResponse> {
  const days = rangeToDays(range);
  const now = new Date();
  const currentStart = new Date(now);
  currentStart.setDate(currentStart.getDate() - (days - 1));
  currentStart.setHours(0, 0, 0, 0);
  const previousEnd = new Date(currentStart.getTime() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - (days - 1));
  previousStart.setHours(0, 0, 0, 0);
  const sinceIso = previousStart.toISOString();

  const { data: changeRows, error: changeErr } = await scopeActiveChangeEvents(
    supabase
      .from("change_events")
      .select("id, title, status, submitted_at, created_at, updated_at, due_at, sla_status, estimated_mrr_affected")
  )
    .eq("org_id", orgId)
    .gte("created_at", sinceIso);
  if (changeErr) throw new Error(changeErr.message);

  const changes = (changeRows ?? []) as ChangeRow[];
  const changeIds = changes.map((c) => c.id);

  const latestRiskByChange = new Map<string, LatestRisk>();
  if (changeIds.length > 0) {
    const { data: impactRows } = await supabase
      .from("impact_assessments")
      .select("change_event_id, risk_bucket, risk_score_raw, created_at")
      .in("change_event_id", changeIds)
      .order("created_at", { ascending: false });
    for (const row of impactRows ?? []) {
      const id = String(row.change_event_id);
      if (!latestRiskByChange.has(id)) {
        latestRiskByChange.set(id, {
          risk_bucket: row.risk_bucket ?? null,
          risk_score_raw: row.risk_score_raw == null ? null : Number(row.risk_score_raw),
        });
      }
    }
  }

  const approvals =
    changeIds.length > 0
      ? (
          await supabase
            .from("approvals")
            .select("change_event_id, decision, decided_at, created_at")
            .eq("org_id", orgId)
            .in("change_event_id", changeIds)
        ).data ?? []
      : [];

  const incidents =
    changeIds.length > 0
      ? (
          await supabase
            .from("incidents")
            .select("change_event_id, created_at")
            .in("change_event_id", changeIds)
        ).data ?? []
      : [];

  const { data: allIssues } = await supabase
    .from("issues")
    .select("id, title, status, severity, source_type, source_ref, created_at, resolved_at, updated_at")
    .eq("org_id", orgId)
    .gte("created_at", sinceIso);

  const issueIds = (allIssues ?? []).map((i) => i.id);
  const issueActions =
    issueIds.length > 0
      ? (
          await supabase
            .from("issue_actions")
            .select("issue_id, action_status, action_type, created_at, executed_at")
            .in("issue_id", issueIds)
        ).data ?? []
      : [];

  const approvalTimesByChange = new Map<string, string[]>();
  const governedReviewByChange = new Set<string>();
  for (const a of approvals) {
    if (a.decision && a.decision !== "PENDING") {
      const ts = (a.decided_at ?? a.created_at) as string | null;
      if (!ts) continue;
      const cid = String(a.change_event_id);
      const arr = approvalTimesByChange.get(cid) ?? [];
      arr.push(ts);
      approvalTimesByChange.set(cid, arr);
      governedReviewByChange.add(cid);
    }
  }

  const earliestIncidentByChange = new Map<string, string>();
  for (const inc of incidents) {
    const cid = String(inc.change_event_id);
    const at = String(inc.created_at ?? "");
    if (!at) continue;
    const current = earliestIncidentByChange.get(cid);
    if (!current || at < current) earliestIncidentByChange.set(cid, at);
  }

  const successfulIssueActions = new Set<string>();
  for (const action of issueActions) {
    const ts = (action.executed_at ?? action.created_at) as string | null;
    if (!ts) continue;
    const issueId = String(action.issue_id);
    if (String(action.action_status).toLowerCase() === "done") successfulIssueActions.add(issueId);
  }

  const currentStartMs = currentStart.getTime();
  const previousStartMs = previousStart.getTime();
  const previousEndMs = previousEnd.getTime();
  const nowMs = now.getTime();
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

  const inCurrent = (iso: string | null | undefined) => {
    if (!iso) return false;
    const ms = new Date(iso).getTime();
    return ms >= currentStartMs && ms <= nowMs;
  };
  const inPrevious = (iso: string | null | undefined) => {
    if (!iso) return false;
    const ms = new Date(iso).getTime();
    return ms >= previousStartMs && ms <= previousEndMs;
  };

  let preventedLikelyCount = 0;
  let preventedObservedCount = 0;
  let highRiskTotal = 0;
  let governedHighRiskCount = 0;
  let highRiskCurrent = 0;
  let highRiskPrevious = 0;
  let overdueCurrent = 0;
  let overduePrevious = 0;
  const exposureCurrentValues: number[] = [];
  const exposurePreviousValues: number[] = [];
  const stories: RoiStoryCard[] = [];

  for (const change of changes) {
    const risk = latestRiskByChange.get(change.id);
    const isHighRisk =
      risk?.risk_bucket === "HIGH" ||
      risk?.risk_bucket === "CRITICAL" ||
      Number(risk?.risk_score_raw ?? 0) >= 70;
    const changeCreated = change.created_at ?? change.submitted_at;
    if (inCurrent(changeCreated) && isHighRisk) highRiskCurrent += 1;
    if (inPrevious(changeCreated) && isHighRisk) highRiskPrevious += 1;

    const dueAt = change.due_at ? new Date(change.due_at).getTime() : null;
    const isOverdue = change.sla_status === "OVERDUE" || change.sla_status === "ESCALATED" || (dueAt != null && dueAt < nowMs);
    if (inCurrent(changeCreated) && isOverdue) overdueCurrent += 1;
    if (inPrevious(changeCreated) && isOverdue) overduePrevious += 1;

    const estExposure = Math.max(0, Number(change.estimated_mrr_affected ?? 0));
    if (inCurrent(changeCreated)) exposureCurrentValues.push(estExposure);
    if (inPrevious(changeCreated)) exposurePreviousValues.push(estExposure);

    if (!inCurrent(changeCreated) || !isHighRisk) continue;
    highRiskTotal += 1;

    const reviewTimes = (approvalTimesByChange.get(change.id) ?? []).sort();
    const reviewTime = reviewTimes[0] ? new Date(reviewTimes[0]).getTime() : null;
    const completionTime =
      change.status && ["APPROVED", "RESOLVED", "CLOSED"].includes(String(change.status).toUpperCase())
        ? new Date(change.updated_at ?? change.created_at ?? now.toISOString()).getTime()
        : Number.POSITIVE_INFINITY;
    const incidentAt = earliestIncidentByChange.get(change.id);
    const incidentTime = incidentAt ? new Date(incidentAt).getTime() : Number.POSITIVE_INFINITY;
    const impactBoundary = computeImpactBoundary({
      completionTimeMs: Number.isFinite(completionTime) ? completionTime : null,
      incidentTimeMs: Number.isFinite(incidentTime) ? incidentTime : null,
    });
    const hasInterventionBeforeImpact = reviewTime != null && reviewTime < impactBoundary;

    if (governedReviewByChange.has(change.id)) governedHighRiskCount += 1;

    const noDownstreamWindowMet = qualifiesLikelyPrevented({
      interventionTimeMs: reviewTime,
      impactBoundaryTimeMs: impactBoundary,
      incidentTimeMs: Number.isFinite(incidentTime) ? incidentTime : null,
      nowMs,
      noIncidentWindowMs: fourteenDaysMs,
    });

    if (hasInterventionBeforeImpact && noDownstreamWindowMet) {
      preventedLikelyCount += 1;
      if (stories.length < 6) {
        stories.push({
          id: `change-${change.id}`,
          title: change.title ?? "High-risk change intervention",
          summary: "Reviewed before impact and no downstream issue detected for 14 days.",
          confidence: "likely_prevented",
          whyThisCounts:
            "Early intervention on a high-risk change reduced the likelihood of downstream revenue impact.",
          happenedAt: reviewTimes[0],
          href: `/changes/${change.id}?source=roi&range=${range}`,
          entityType: "change",
          entityId: change.id,
        });
      }
    } else if (hasInterventionBeforeImpact) {
      preventedObservedCount += 1;
    }
  }

  let resolvedCurrent = 0;
  let resolvedPrevious = 0;
  const issueResolutionHoursCurrent: number[] = [];
  const issueResolutionHoursPrevious: number[] = [];
  for (const issue of allIssues ?? []) {
    const resolvedAt = issue.resolved_at ?? (["resolved", "verified"].includes(String(issue.status)) ? issue.updated_at : null);
    const hasTerminalResolution = Boolean(resolvedAt);
    const hasSuccessfulAction = successfulIssueActions.has(issue.id);
    if (!hasTerminalResolution && !hasSuccessfulAction) continue;

    if (inCurrent(resolvedAt)) resolvedCurrent += 1;
    if (inPrevious(resolvedAt)) resolvedPrevious += 1;

    const openedMs = issue.created_at ? new Date(issue.created_at).getTime() : null;
    const resolvedMs = resolvedAt ? new Date(resolvedAt).getTime() : null;
    if (openedMs && resolvedMs && resolvedMs > openedMs) {
      const hours = (resolvedMs - openedMs) / (1000 * 60 * 60);
      if (inCurrent(resolvedAt)) issueResolutionHoursCurrent.push(hours);
      if (inPrevious(resolvedAt)) issueResolutionHoursPrevious.push(hours);
    }

    if (stories.length < 10 && inCurrent(resolvedAt)) {
      stories.push({
        id: `issue-${issue.id}`,
        title: issue.title ?? "Issue resolved",
        summary: "Issue moved to a terminal resolved state or completed mitigation action.",
        confidence: "confirmed_resolved",
        whyThisCounts: "Resolving active issues reduces direct operational and revenue risk.",
        happenedAt: resolvedAt ?? issue.updated_at ?? issue.created_at,
        href: `/issues/${issue.id}?source=roi&range=${range}`,
        entityType: "issue",
        entityId: issue.id,
      });
    }
  }

  const approvalLatencyHoursCurrent: number[] = [];
  const approvalLatencyHoursPrevious: number[] = [];
  for (const change of changes) {
    const changeCreated = change.created_at ?? change.submitted_at;
    const reviewTimes = (approvalTimesByChange.get(change.id) ?? []).sort();
    if (!changeCreated || reviewTimes.length === 0) continue;
    const createdMs = new Date(changeCreated).getTime();
    const firstReviewMs = new Date(reviewTimes[0]).getTime();
    if (firstReviewMs <= createdMs) continue;
    const hours = (firstReviewMs - createdMs) / (1000 * 60 * 60);
    if (inCurrent(reviewTimes[0])) approvalLatencyHoursCurrent.push(hours);
    if (inPrevious(reviewTimes[0])) approvalLatencyHoursPrevious.push(hours);
  }

  const reviewedHighRiskPercent = highRiskTotal > 0 ? Math.round((governedHighRiskCount / highRiskTotal) * 100) : 0;
  const exposureCurrent = exposureCurrentValues.reduce((a, b) => a + b, 0);
  const exposurePrevious = exposurePreviousValues.reduce((a, b) => a + b, 0);
  const exposureDeltaPct = exposurePrevious > 0 ? ((exposureCurrent - exposurePrevious) / exposurePrevious) * 100 : 0;
  const exposureDirection =
    exposureDeltaPct > 5 ? "increasing" : exposureDeltaPct < -5 ? "decreasing" : "stable";
  const overdueDelta = overdueCurrent - overduePrevious;
  const highRiskDelta = highRiskCurrent - highRiskPrevious;
  const trendState: RoiSummaryResponse["impactSummary"]["trend"] =
    exposureDirection === "decreasing" && overdueDelta <= 0 && highRiskDelta <= 0
      ? "improving"
      : exposureDirection === "stable" && overdueDelta <= 0
        ? "stable"
        : "needs_attention";

  const approvalMedianCurrent = median(approvalLatencyHoursCurrent);
  const approvalMedianPrevious = median(approvalLatencyHoursPrevious);
  const issueResolutionMedianCurrent = median(issueResolutionHoursCurrent);
  const issueResolutionMedianPrevious = median(issueResolutionHoursPrevious);

  const approvalDeltaPct =
    approvalMedianPrevious > 0
      ? ((approvalMedianCurrent - approvalMedianPrevious) / approvalMedianPrevious) * 100
      : 0;
  const issueResDeltaPct =
    issueResolutionMedianPrevious > 0
      ? ((issueResolutionMedianCurrent - issueResolutionMedianPrevious) / issueResolutionMedianPrevious) * 100
      : 0;

  const sortedStories = stories
    .sort((a, b) => {
      const confDiff = confidenceRank(b.confidence) - confidenceRank(a.confidence);
      if (confDiff !== 0) return confDiff;
      return new Date(b.happenedAt).getTime() - new Date(a.happenedAt).getTime();
    })
    .slice(0, 3);

  return {
    ok: true,
    range,
    rangeDays: days,
    asOf: new Date().toISOString(),
    confidenceModel: ["estimated", "observed", "likely_prevented", "confirmed_resolved"],
    impactSummary: {
      preventedLikelyCount,
      resolvedCount: resolvedCurrent,
      governedCount: governedHighRiskCount,
      reviewedHighRiskPercent,
      trend: trendState,
      estimatedExposure: exposureCurrent,
    },
    trendImprovement: {
      exposureDirection,
      exposureDeltaPct,
      overdueDelta,
      highRiskDelta,
    },
    kpis: {
      overdueReduction: buildMetric({
        key: "overdue_reduction",
        label: "Overdue reduction",
        value: overduePrevious - overdueCurrent,
        displayValue: fmtNumber(overduePrevious - overdueCurrent),
        confidence: "observed",
        valueStatement: `${fmtNumber(overduePrevious - overdueCurrent)} fewer overdue items than previous ${range}.`,
        howDetermined: "Compares current overdue high-risk items to the immediately previous equal window.",
      }),
      approvalLatencyTrend: buildMetric({
        key: "approval_latency_trend",
        label: "Median approval latency trend",
        value: approvalDeltaPct,
        displayValue: fmtPct(approvalDeltaPct),
        confidence: "observed",
        valueStatement: `${approvalDeltaPct <= 0 ? "Faster" : "Slower"} approval timing vs previous ${range}.`,
        howDetermined:
          "Median hours from change creation/submission to first non-pending approval decision, compared against previous window.",
      }),
      issueResolutionTrend: buildMetric({
        key: "issue_resolution_trend",
        label: "Median issue resolution time trend",
        value: issueResDeltaPct,
        displayValue: fmtPct(issueResDeltaPct),
        confidence: "confirmed_resolved",
        valueStatement: `${issueResDeltaPct <= 0 ? "Faster" : "Slower"} issue resolution vs previous ${range}.`,
        howDetermined:
          "Median hours from issue creation to terminal resolution signal, compared against the previous equal window.",
      }),
    },
    metrics: {
      prevented: buildMetric({
        key: "potential_prevented",
        label: "Potential issues prevented",
        value: preventedLikelyCount,
        displayValue: fmtNumber(preventedLikelyCount),
        confidence: "likely_prevented",
        valueStatement: `${fmtNumber(preventedLikelyCount)} high-risk situations addressed before impact (likely prevented).`,
        howDetermined:
          `High-risk changes with intervention before impact boundary and no downstream incident observed for 14 days (${fmtNumber(preventedObservedCount)} additional observed with partial evidence).`,
      }),
      resolved: buildMetric({
        key: "issues_resolved",
        label: "Issues resolved",
        value: resolvedCurrent,
        displayValue: fmtNumber(resolvedCurrent),
        confidence: "confirmed_resolved",
        valueStatement: `${fmtNumber(resolvedCurrent)} issues resolved or successfully mitigated in current ${range} (vs ${fmtNumber(resolvedPrevious)} previous).`,
        howDetermined:
          "Counts issues with terminal resolution signals or linked successful mitigation actions in the selected window.",
      }),
      governed: buildMetric({
        key: "high_risk_governed",
        label: "High-risk changes reviewed",
        value: governedHighRiskCount,
        displayValue: `${fmtNumber(governedHighRiskCount)} (${fmtPct(reviewedHighRiskPercent)})`,
        confidence: "observed",
        valueStatement: `${fmtNumber(governedHighRiskCount)} high-risk changes reviewed before completion or incident impact.`,
        howDetermined:
          "High-risk change is defined as HIGH/CRITICAL risk (or equivalent score fallback) with a non-pending approval intervention.",
      }),
      trend: buildMetric({
        key: "risk_trend_improvement",
        label: "Risk trend improvement",
        value: exposureDeltaPct,
        displayValue: fmtPct(exposureDeltaPct),
        confidence: "estimated",
        valueStatement: `Estimated exposure is ${exposureDirection} vs previous ${range}.`,
        howDetermined:
          "Compares summed estimated exposure in current window against previous equal window using change exposure fields.",
      }),
    },
    stories: sortedStories,
    previousWindow: { start: previousStart.toISOString(), end: previousEnd.toISOString() },
    currentWindow: { start: currentStart.toISOString(), end: now.toISOString() },
  };
}
