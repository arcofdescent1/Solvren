/**
 * GET /api/dashboard/next-actions
 * Gap 1: Role-aware list of next actions for the Overview dashboard.
 */
import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { filterVisibleChanges } from "@/lib/access/changeAccess";
import { canRole } from "@/lib/rbac/permissions";
import { parseOrgRole } from "@/lib/rbac/roles";
import { isAdminLikeRole } from "@/lib/rbac/roles";

export type NextActionItem = {
  id: string;
  label: string;
  href: string;
  count?: number;
  severity?: "info" | "warning" | "high";
};

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const role = parseOrgRole(memberships.find((m) => m.orgId === activeOrgId)?.role ?? "viewer");
  const isReviewer = canRole(role, "change.approve");
  const isAdmin = activeOrgId && isAdminLikeRole(role);
  const orgIds = memberships.map((m) => m.orgId);

  const actions: NextActionItem[] = [];

  if (!activeOrgId || orgIds.length === 0) {
    return NextResponse.json({
      actions: [{ id: "onboard", label: "Create or join an organization", href: "/onboarding", severity: "info" }],
    });
  }

  // Pending approvals (reviewer)
  if (isReviewer) {
    const { data: approvalRows } = await supabase
      .from("approvals")
      .select("change_event_id")
      .in("org_id", orgIds)
      .eq("approver_user_id", userRes.user.id)
      .eq("decision", "PENDING");
    const changeIds = Array.from(new Set((approvalRows ?? []).map((r) => r.change_event_id)));
    if (changeIds.length > 0) {
      const { data: changes } = await scopeActiveChangeEvents(supabase.from("change_events").select("id, org_id, domain, systems_involved, created_by, is_restricted, status"))
        .in("id", changeIds);
      const visible = await filterVisibleChanges(supabase, userRes.user.id, changes ?? []);
      if (visible.length > 0) {
        actions.push({
          id: "review-approval",
          label: "Review pending approval",
          href: "/queue/my-approvals",
          count: visible.length,
          severity: "high",
        });
      }
    }
  }

  // In-review / blocked / overdue (links to Changes with view)
  const { data: inReviewRows } = await scopeActiveChangeEvents(supabase.from("change_events").select("id, org_id, domain, systems_involved, created_by, is_restricted, due_at, status"))
    .in("org_id", orgIds)
    .eq("status", "IN_REVIEW")
    .limit(50);
  const visibleInReview = await filterVisibleChanges(supabase, userRes.user.id, inReviewRows ?? []);
  const overdue = visibleInReview.filter((r) => r.due_at && new Date(r.due_at) < new Date());

  if (overdue.length > 0 && isReviewer) {
    actions.push({
      id: "overdue",
      label: "Review overdue items",
      href: "/queue/overdue",
      count: overdue.length,
      severity: "high",
    });
  }

  // Complete evidence (contributor: changes I created or am involved in that are blocked)
  const inReviewIds = visibleInReview.map((r) => r.id);
  const { data: evidenceRows } = inReviewIds.length
    ? await supabase
        .from("change_evidence_items")
        .select("change_event_id, status, severity")
        .in("change_event_id", inReviewIds)
        .eq("severity", "REQUIRED")
    : { data: [] };
  const missingByChange = new Map<string, number>();
  for (const e of evidenceRows ?? []) {
    if (e.status === "PROVIDED" || e.status === "WAIVED") continue;
    missingByChange.set(e.change_event_id, (missingByChange.get(e.change_event_id) ?? 0) + 1);
  }
  const blockedCount = visibleInReview.filter((r) => (missingByChange.get(r.id) ?? 0) > 0).length;
  if (blockedCount > 0) {
    actions.push({
      id: "complete-evidence",
      label: "Complete evidence for blocked changes",
      href: "/queue/blocked",
      count: blockedCount,
      severity: "warning",
    });
  }

  // Investigate high-risk event (unapproved high-risk events)
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const { data: highRisk } = await supabase
    .from("risk_events")
    .select("id")
    .eq("org_id", activeOrgId)
    .gte("timestamp", since.toISOString())
    .gt("risk_score", 80)
    .is("approved_at", null)
    .limit(10);
  if ((highRisk?.length ?? 0) > 0) {
    actions.push({
      id: "investigate-risk",
      label: "Investigate high-risk events",
      href: "/risk/audit",
      count: highRisk!.length,
      severity: "warning",
    });
  }

  // Admin: connect Jira / retry integration
  if (isAdmin) {
    const { data: config } = await supabase
      .from("integration_configs")
      .select("id, provider, status")
      .eq("org_id", activeOrgId)
      .eq("provider", "jira")
      .maybeSingle();
    if (!config || config.status !== "ACTIVE") {
      actions.push({
        id: "connect-jira",
        label: "Connect Jira",
        href: "/org/settings/integrations",
        severity: "info",
      });
    }
    const { data: failedOutbox } = await supabase
      .from("notification_outbox")
      .select("id")
      .eq("org_id", activeOrgId)
      .eq("status", "FAILED")
      .limit(1);
    if ((failedOutbox?.length ?? 0) > 0) {
      actions.push({
        id: "retry-integration",
        label: "Retry failed notifications",
        href: "/settings/system/diagnostics",
        severity: "warning",
      });
    }
  }

  // Default if nothing else
  if (actions.length === 0) {
    actions.push({
      id: "view-changes",
      label: "View revenue changes",
      href: "/changes",
      severity: "info",
    });
  }

  return NextResponse.json({ actions });
}
