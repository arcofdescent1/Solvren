import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { filterVisibleChanges } from "@/lib/access/changeAccess";
import HomeCommandCenterClient from "@/components/home/HomeCommandCenterClient";
import { getTopPriorities } from "@/features/home/presentation/homePriorities";
import { getAssignedItems } from "@/features/home/presentation/homeAssignments";
import { getWaitingItems } from "@/features/home/presentation/homeWaitingItems";
import {
  buildExposureMetrics,
  formatEstimatedExposure,
} from "@/features/home/presentation/homeExposure";
import { buildProtectionCards } from "@/features/home/presentation/homeProtection";
import type { HomeActivityItem, HomeWorkItem } from "@/features/home/presentation/types";
import { buildRoiSummary } from "@/features/roi/buildRoiSummary";
import type { RoiTrendState } from "@/features/roi/types";

function relTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function isHighImpactBucket(bucket: string | null) {
  const b = (bucket ?? "").toUpperCase();
  return b === "HIGH" || b === "CRITICAL";
}

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/login");

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id);
  if (!memberships?.length) redirect("/onboarding");
  const orgIds = memberships.map((m) => m.org_id);
  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);

  let showPhase2SuccessCard = false;
  if (activeOrgId) {
    const [{ data: obs }, { data: ucs }] = await Promise.all([
      supabase.from("org_onboarding_states").select("phase2_status, phase2_completed_at").eq("org_id", activeOrgId).maybeSingle(),
      supabase
        .from("user_phase2_success_card_state")
        .select("dismissed_at")
        .eq("org_id", activeOrgId)
        .eq("user_id", userRes.user.id)
        .maybeSingle(),
    ]);
    const o = obs as { phase2_status?: string | null; phase2_completed_at?: string | null } | null;
    const u = ucs as { dismissed_at?: string | null } | null;
    const completedAt = o?.phase2_completed_at;
    showPhase2SuccessCard = Boolean(
      o?.phase2_status === "COMPLETED" &&
        completedAt &&
        !u?.dismissed_at &&
        Date.now() - new Date(completedAt).getTime() < 7 * 86400000
    );
  }

  const nowIso = new Date().toISOString();
  const [changesRaw, myApprovals, issueRows, failedOutbox, impactRows, incidentRows, integrations, riskEvents, auditRows] =
    await Promise.all([
      scopeActiveChangeEvents(
        supabase
          .from("change_events")
          .select("id, title, status, due_at, created_by, domain, sla_status, org_id, is_restricted, submitted_at")
          .in("org_id", orgIds)
          .in("status", ["DRAFT", "READY", "SUBMITTED", "IN_REVIEW"])
      ).limit(250),
      supabase
        .from("approvals")
        .select("id, change_event_id")
        .in("org_id", orgIds)
        .eq("approver_user_id", userRes.user.id)
        .eq("decision", "PENDING"),
      supabase
        .from("issues")
        .select("id, issue_key, title, status, severity, owner_user_id, updated_at, created_at")
        .in("org_id", orgIds)
        .limit(150),
      supabase
        .from("notification_outbox")
        .select("change_event_id, status")
        .in("org_id", orgIds)
        .in("status", ["FAILED", "PENDING", "PROCESSING"])
        .limit(500),
      supabase
        .from("impact_assessments")
        .select("change_event_id, risk_bucket, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("incidents").select("change_event_id").limit(300),
      supabase
        .from("integration_accounts")
        .select("provider, status, last_success_at, last_error_message")
        .in("org_id", orgIds),
      supabase
        .from("risk_events")
        .select("id, impact_amount, approved_at, timestamp")
        .in("org_id", orgIds)
        .order("timestamp", { ascending: false })
        .limit(200),
      supabase
        .from("audit_log")
        .select("id, action, entity_type, entity_id, created_at, metadata")
        .in("org_id", orgIds)
        .order("created_at", { ascending: false })
        .limit(60),
    ]);


  const visibleChanges = await filterVisibleChanges(
    supabase,
    userRes.user.id,
    changesRaw.data ?? []
  );
  const pendingApprovalSet = new Set(
    (myApprovals.data ?? []).map((a) => a.change_event_id).filter(Boolean)
  );
  const failedByChange = new Map<string, number>();
  const pendingByChange = new Map<string, number>();
  for (const row of failedOutbox.data ?? []) {
    if (!row.change_event_id) continue;
    if (row.status === "FAILED") {
      failedByChange.set(row.change_event_id, (failedByChange.get(row.change_event_id) ?? 0) + 1);
    } else {
      pendingByChange.set(row.change_event_id, (pendingByChange.get(row.change_event_id) ?? 0) + 1);
    }
  }
  const incidentByChange = new Set((incidentRows.data ?? []).map((r) => r.change_event_id).filter(Boolean));

  const impactByChange = new Map<string, string | null>();
  for (const row of impactRows.data ?? []) {
    if (row.change_event_id && !impactByChange.has(row.change_event_id)) {
      impactByChange.set(row.change_event_id, row.risk_bucket ?? null);
    }
  }

  const workItems: HomeWorkItem[] = [];
  for (const change of visibleChanges) {
    const changeId = change.id as string;
    const overdue = Boolean(change.due_at && change.due_at < nowIso) || change.sla_status === "ESCALATED";
    const myPending = pendingApprovalSet.has(changeId);
    const failedCount = failedByChange.get(changeId) ?? 0;
    const highImpact = isHighImpactBucket(impactByChange.get(changeId) ?? null);
    const missingDetails = (change.status ?? "") === "DRAFT";
    const blocked = missingDetails || failedCount > 0 || overdue;
    const assignedToCurrentUser = myPending || change.created_by === userRes.user.id;
    workItems.push({
      id: changeId,
      objectType: "Change",
      title: change.title ?? "Untitled change",
      why: myPending
        ? "Awaiting your review"
        : overdue
        ? "Overdue and needs follow-up"
        : failedCount > 0
        ? "Delivery failures need retry"
        : "In flight and revenue-relevant",
      urgency: overdue || failedCount > 0 ? "high" : highImpact ? "high" : "medium",
      nextStep: myPending
        ? "Review approvals"
        : missingDetails
        ? "Add supporting details"
        : failedCount > 0
        ? "Retry notifications"
        : "View change",
      destination: `/changes/${changeId}`,
      assignedToCurrentUser,
      highImpact,
      overdue,
      linkedToActiveIssue: incidentByChange.has(changeId),
      blocked,
      retryRequired: failedCount > 0,
      waitingReason: blocked ? (myPending ? "Waiting on your review" : "Waiting on external follow-up") : undefined,
      waitingOn: !assignedToCurrentUser && blocked ? "Another team or approver" : undefined,
    });
  }

  for (const issue of issueRows.data ?? []) {
    const status = String(issue.status ?? "");
    const isOpen = ["open", "triaged", "assigned", "in_progress"].includes(status);
    if (!isOpen) continue;
    const severity = String(issue.severity ?? "").toLowerCase();
    const highImpact = severity === "high" || severity === "critical";
    const assignedToCurrentUser = issue.owner_user_id === userRes.user.id;
    workItems.push({
      id: issue.id,
      objectType: "Issue",
      title: issue.title ?? issue.issue_key ?? "Untitled issue",
      why: highImpact ? "High-impact issue affecting revenue workflows" : "Issue requires investigation",
      urgency: highImpact ? "high" : "medium",
      nextStep: "Open issue",
      destination: `/issues/${issue.id}`,
      assignedToCurrentUser,
      highImpact,
      overdue: false,
      linkedToActiveIssue: true,
      blocked: false,
      retryRequired: false,
      rankBoost: highImpact ? 120 : 0,
    });
  }

  const priorities = getTopPriorities(workItems, 5);
  const assigned = getAssignedItems(workItems);
  const waiting = getWaitingItems(workItems);

  const openHighImpactIssues = workItems.filter((x) => x.objectType === "Issue" && x.highImpact).length;
  const highImpactChanges = workItems.filter((x) => x.objectType === "Change" && x.highImpact).length;
  const overdueItems = workItems.filter((x) => x.overdue).length;
  const linkedIncidents = workItems.filter((x) => x.linkedToActiveIssue).length;

  let roiSignal: RoiTrendState = "stable";
  let roiSignalAsOf: string | null = null;
  const orgForRoi = activeOrgId ?? orgIds[0];
  if (orgForRoi) {
    try {
      const roi = await buildRoiSummary(supabase, orgForRoi, "30d");
      roiSignal = roi.impactSummary.trend;
      roiSignalAsOf = roi.asOf;
    } catch {
      roiSignal = "stable";
      roiSignalAsOf = null;
    }
  }
  const exposureEstimate = (riskEvents.data ?? []).reduce((sum, row) => {
    const open = !row.approved_at;
    const amount = Number(row.impact_amount ?? 0);
    return open && Number.isFinite(amount) ? sum + amount : sum;
  }, 0);

  const exposureLabel = formatEstimatedExposure(exposureEstimate > 0 ? exposureEstimate : null);
  const exposureMetrics = buildExposureMetrics({
    openHighImpactIssues,
    highImpactChanges,
    overdueItems,
    linkedIncidents,
  });

  const integrationRows = integrations.data ?? [];
  const connectedSystems = integrationRows.filter((i) => i.status === "connected").length;
  const staleSystems = integrationRows.filter((i) => Boolean(i.last_error_message)).length;
  const protectionCards = buildProtectionCards({
    connectedSystems,
    totalSystems: integrationRows.length,
    staleSystems,
    reviewCoverageEnabled: visibleChanges.length > 0 ? 1 : 0,
  });
  const setupIncomplete = connectedSystems === 0;

  const activity: HomeActivityItem[] = (auditRows.data ?? [])
    .map((row) => {
      const action = String(row.action ?? "");
      const lower = action.toLowerCase();
      if (
        !(
          lower.includes("issue") ||
          lower.includes("change") ||
          lower.includes("approval") ||
          lower.includes("overdue") ||
          lower.includes("details") ||
          lower.includes("retry")
        )
      ) {
        return null;
      }
      const entityId = String(row.entity_id ?? "");
      const destination = row.entity_type === "issue" ? `/issues/${entityId}` : row.entity_type === "change" ? `/changes/${entityId}` : "/actions";
      return {
        id: row.id,
        title: action.replaceAll("_", " "),
        context: row.entity_type ? String(row.entity_type) : undefined,
        relativeTime: relTime(row.created_at),
        destination,
        objectType: row.entity_type === "issue" ? "Issue" : row.entity_type === "change" ? "Change" : "System",
      } as HomeActivityItem;
    })
    .filter((item): item is HomeActivityItem => Boolean(item))
    .slice(0, 10);

  return (
    <HomeCommandCenterClient
      userId={userRes.user.id}
      orgId={activeOrgId ?? null}
      showPhase2SuccessCard={showPhase2SuccessCard}
      priorities={priorities}
      assigned={assigned}
      waiting={waiting}
      exposureLabel={exposureLabel}
      exposureMetrics={exposureMetrics}
      protectionCards={protectionCards}
      activity={activity}
      setupIncomplete={setupIncomplete}
      roiSignal={roiSignal}
      roiSignalAsOf={roiSignalAsOf}
    />
  );
}
