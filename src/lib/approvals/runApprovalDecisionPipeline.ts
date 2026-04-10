import type { SupabaseClient } from "@supabase/supabase-js";
import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { getReadyStatus } from "@/services/risk/readyStatus";
import { auditLog } from "@/lib/audit";
import { addTimelineEvent, type TimelineEventType } from "@/services/timeline/addTimelineEvent";
import { enqueueNotificationEvents } from "@/services/notifications/createNotifications";
import { enqueueJiraIssuePropertySync, enqueueJiraCommentSync } from "@/services/jira/jiraSyncService";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  evaluateGovernance,
  bindGovernanceApprovalRequest,
  deploymentGovernanceEnvironment,
} from "@/modules/governance";

export type ApprovalRowForPipeline = {
  id: string;
  change_event_id: string;
  approver_user_id: string;
  decision: string;
  org_id: string;
  domain: string | null;
  approval_area: string | null;
};

export type ApprovalDecisionPipelineResult =
  | { ok: true; nextStatus: string }
  | {
      ok: false;
      status: number;
      error: string;
      code?: string;
      missingEvidence?: string[];
      readyStatus?: unknown;
      governance?: unknown;
      approvalRequestId?: string | null;
      governanceTraceId?: string | null;
    };

/**
 * Shared approval decision path for web (/api/approvals/decide) and Slack worker.
 * Caller must enforce authz (assigned approver / delegate / RBAC).
 */
export async function runApprovalDecisionPipeline(
  supabase: SupabaseClient,
  args: {
    approval: ApprovalRowForPipeline;
    actorUserId: string;
    decision: "APPROVED" | "REJECTED";
    comment: string | null;
    membershipOrgRole: string | null;
    /** When true, timeline uses APPROVAL_*_FROM_SLACK event types */
    fromSlack?: boolean;
  }
): Promise<ApprovalDecisionPipelineResult> {
  const { approval, actorUserId, decision, comment, membershipOrgRole, fromSlack } = args;

  if (approval.decision !== "PENDING") {
    const { data: ce } = await scopeActiveChangeEvents(supabase.from("change_events").select("status"))
      .eq("id", approval.change_event_id)
      .maybeSingle();
    return { ok: true, nextStatus: (ce as { status?: string } | null)?.status ?? "IN_REVIEW" };
  }

  if (decision === "APPROVED") {
    try {
      const readyStatus = await getReadyStatus(supabase, {
        changeId: approval.change_event_id,
      });
      if (!readyStatus.ready) {
        const missingEvidence = readyStatus.missingEvidence ?? [];
        if (readyStatus.approvalBlockedMissingEvidence && missingEvidence.length > 0) {
          await auditLog(supabase, {
            orgId: approval.org_id,
            actorId: actorUserId,
            action: "approval_blocked_missing_evidence",
            entityType: "change",
            entityId: approval.change_event_id,
            metadata: {
              missingEvidence,
              code: "REQUIRED_EVIDENCE_MISSING",
            },
          });
          return {
            ok: false,
            status: 400,
            error: "Cannot approve. Missing required evidence.",
            code: "REQUIRED_EVIDENCE_MISSING",
            missingEvidence,
          };
        }
        return {
          ok: false,
          status: 400,
          error: "Change is not ready for approval",
          code: "NOT_READY",
          readyStatus,
        };
      }
    } catch (e) {
      return {
        ok: false,
        status: 500,
        error: e instanceof Error ? e.message : "Ready check failed",
      };
    }
  }

  const { data: ceSla } = await scopeActiveChangeEvents(
    supabase.from("change_events").select("sla_status, org_id, domain")
  )
    .eq("id", approval.change_event_id)
    .maybeSingle();
  if (decision === "APPROVED" && ceSla?.sla_status === "ESCALATED") {
    const { data: execAppr, error: execErr } = await supabase
      .from("approvals")
      .select("id")
      .eq("change_event_id", approval.change_event_id)
      .eq("approval_area", "EXEC")
      .limit(1)
      .maybeSingle();

    if (execErr) {
      return { ok: false, status: 500, error: execErr.message };
    }

    if (!execAppr?.id) {
      const orgId = String((ceSla as { org_id?: string }).org_id ?? approval.org_id);

      const { data: roleRows, error: roleErr } = await supabase
        .from("organization_member_roles")
        .select("user_id")
        .eq("org_id", orgId)
        .eq("role_key", "EXEC")
        .order("created_at", { ascending: true })
        .limit(1);

      if (roleErr) {
        return { ok: false, status: 500, error: roleErr.message };
      }

      let execUserId = String((roleRows?.[0] as { user_id?: string } | undefined)?.user_id ?? "");

      if (!execUserId) {
        const { data: adminMember, error: memErr } = await supabase
          .from("organization_members")
          .select("user_id")
          .eq("org_id", orgId)
          .in("role", ["owner", "admin"])
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (memErr) {
          return { ok: false, status: 500, error: memErr.message };
        }
        execUserId = String((adminMember as { user_id?: string } | null)?.user_id ?? "");
      }

      if (!execUserId) {
        const { data: anyMember, error: anyErr } = await supabase
          .from("organization_members")
          .select("user_id")
          .eq("org_id", orgId)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (anyErr) {
          return { ok: false, status: 500, error: anyErr.message };
        }
        execUserId = String((anyMember as { user_id?: string } | null)?.user_id ?? "");
      }

      if (!execUserId) {
        return {
          ok: false,
          status: 400,
          error: "Escalated approval requires an EXEC approver, but no org members were found.",
        };
      }

      const { error: insErr } = await supabase.from("approvals").insert({
        change_event_id: approval.change_event_id,
        org_id: orgId,
        domain: approval.domain,
        approver_user_id: execUserId,
        approval_area: "EXEC",
        decision: "PENDING",
        comment: null,
        decided_at: null,
      });

      if (insErr) {
        return { ok: false, status: 500, error: insErr.message };
      }

      await auditLog(supabase, {
        orgId,
        changeEventId: approval.change_event_id,
        actorId: actorUserId,
        action: "approval_assigned_escalated",
        entityType: "change",
        entityId: approval.change_event_id,
        metadata: { approval_area: "EXEC" },
      });

      return {
        ok: false,
        status: 400,
        error: "SLA is escalated. An EXEC approval has been assigned and is now required.",
        code: "ESCALATED_REQUIRES_EXEC",
      };
    }
  }

  if (decision === "APPROVED") {
    const { data: changeRow } = await scopeActiveChangeEvents(
      supabase.from("change_events").select("id, org_id, domain")
    )
      .eq("id", approval.change_event_id)
      .maybeSingle();

    const { data: latestAssessment } = await supabase
      .from("impact_assessments")
      .select("risk_bucket")
      .eq("change_event_id", approval.change_event_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const roleKeys = membershipOrgRole ? [membershipOrgRole] : undefined;

    const {
      data: govApprove,
      policyContext: govApproveCtx,
      error: govApproveErr,
    } = await evaluateGovernance(supabase, {
      orgId: approval.org_id,
      environment: deploymentGovernanceEnvironment(),
      actor: {
        userId: actorUserId,
        actorType: "user",
        roleKeys,
      },
      target: {
        resourceType: "change",
        resourceId: approval.change_event_id,
        transitionKey: "approve",
      },
      change: {
        changeId: approval.change_event_id,
        domain: (changeRow as { domain?: string | null } | null)?.domain ?? undefined,
        riskLevel: (latestAssessment as { risk_bucket?: string | null } | null)?.risk_bucket ?? undefined,
      },
      autonomy: { requestedMode: "ASSISTED" },
    });

    if (govApproveErr || !govApprove) {
      return {
        ok: false,
        status: 500,
        error: govApproveErr?.message ?? "Governance evaluation failed",
      };
    }
    if (govApprove.disposition === "BLOCK") {
      await auditLog(supabase, {
        orgId: approval.org_id,
        changeEventId: approval.change_event_id,
        actorId: actorUserId,
        action: "approval_blocked_governance",
        entityType: "change",
        entityId: approval.change_event_id,
        metadata: {
          traceId: govApprove.traceId,
          reasonCodes: govApprove.reasonCodes,
        },
      });
      return {
        ok: false,
        status: 403,
        error: govApprove.explainability.headline,
        code: "GOVERNANCE_BLOCK",
        governance: {
          traceId: govApprove.traceId,
          disposition: govApprove.disposition,
          reasonCodes: govApprove.reasonCodes,
        },
      };
    }
    if (govApprove.disposition === "REQUIRE_APPROVAL") {
      if (!govApproveCtx) {
        return {
          ok: false,
          status: 500,
          error: "Governance requires approval but context was not available",
        };
      }
      const { approvalRequestId, error: bindApprErr } = await bindGovernanceApprovalRequest(
        supabase,
        govApprove,
        govApproveCtx,
        { createdByUserId: actorUserId, createdByType: "user" }
      );
      await auditLog(supabase, {
        orgId: approval.org_id,
        changeEventId: approval.change_event_id,
        actorId: actorUserId,
        action: "approval_deferred_governance_policy",
        entityType: "change",
        entityId: approval.change_event_id,
        metadata: {
          governanceTraceId: govApprove.traceId,
          policyApprovalRequestId: approvalRequestId,
          bindError: bindApprErr?.message,
        },
      });
      return {
        ok: false,
        status: 403,
        error:
          govApprove.explainability.headline ||
          "Additional policy approval is required before this approval can be recorded",
        code: "GOVERNANCE_REQUIRE_APPROVAL",
        approvalRequestId,
        governanceTraceId: govApprove.traceId,
      };
    }
  }

  const actedBy =
    actorUserId === approval.approver_user_id ? null : actorUserId;

  const { error: updErr } = await supabase
    .from("approvals")
    .update({
      decision,
      comment,
      decided_at: new Date().toISOString(),
      acted_by_user_id: actedBy,
    })
    .eq("id", approval.id);

  if (updErr) {
    return { ok: false, status: 500, error: updErr.message };
  }

  const timelineApproved: TimelineEventType = fromSlack
    ? "APPROVAL_APPROVED_FROM_SLACK"
    : "APPROVAL_APPROVED";
  const timelineRejected: TimelineEventType = fromSlack
    ? "APPROVAL_REJECTED_FROM_SLACK"
    : "APPROVAL_REJECTED";

  await auditLog(supabase, {
    orgId: approval.org_id,
    changeEventId: approval.change_event_id,
    actorId: actorUserId,
    action: decision === "APPROVED" ? "approval_granted" : "approval_rejected",
    entityType: "approval",
    entityId: approval.id,
    metadata: {
      change_event_id: approval.change_event_id,
      approval_area: approval.approval_area ?? null,
      comment,
      source: fromSlack ? "slack" : "web",
    },
  });

  await addTimelineEvent({
    supabase,
    orgId: approval.org_id,
    changeEventId: approval.change_event_id,
    actorUserId,
    eventType: decision === "APPROVED" ? timelineApproved : timelineRejected,
    title: decision === "APPROVED" ? "Approval given" : "Approval rejected",
    description: `${approval.approval_area ?? "Approval"} – ${decision}`,
    metadata: {
      approval_area: approval.approval_area ?? null,
      domain: approval.domain ?? null,
      comment,
    },
  });

  const { data: all2, error: allErr2 } = await supabase
    .from("approvals")
    .select("decision")
    .eq("change_event_id", approval.change_event_id);

  if (allErr2) {
    return { ok: false, status: 500, error: allErr2.message };
  }

  const anyRejected = (all2 ?? []).some((x) => x.decision === "REJECTED");
  const allApproved =
    (all2 ?? []).length > 0 && (all2 ?? []).every((x) => x.decision === "APPROVED");

  const nextStatus = anyRejected ? "REJECTED" : allApproved ? "APPROVED" : "IN_REVIEW";

  const { error: ceUpdErr } = await supabase
    .from("change_events")
    .update({ status: nextStatus })
    .eq("id", approval.change_event_id);

  if (ceUpdErr) {
    return { ok: false, status: 500, error: ceUpdErr.message };
  }

  await auditLog(supabase, {
    orgId: approval.org_id,
    changeEventId: approval.change_event_id,
    actorId: actorUserId,
    action: "change_status_updated",
    entityType: "change",
    entityId: approval.change_event_id,
    metadata: { next_status: nextStatus },
  });

  const admin = createAdminClient();
  await enqueueJiraIssuePropertySync(admin, approval.org_id, approval.change_event_id, {});

  if (nextStatus === "APPROVED") {
    await enqueueJiraCommentSync(admin, approval.org_id, approval.change_event_id, "change_approved", {});
    await addTimelineEvent({
      supabase,
      orgId: approval.org_id,
      changeEventId: approval.change_event_id,
      actorUserId,
      eventType: "CHANGE_APPROVED",
      title: "Change approved",
      description: "All approvals granted",
      metadata: {},
    });
    const { data: change } = await admin
      .from("change_events")
      .select("title")
      .eq("id", approval.change_event_id)
      .single();
    await enqueueNotificationEvents(admin, {
      orgId: approval.org_id,
      changeEventId: approval.change_event_id,
      templateKey: "change_approved",
      payload: { title: change?.title ?? null },
      dedupeKeyBase: `change_approved:${approval.change_event_id}`,
      channels: ["IN_APP", "SLACK", "EMAIL"],
    });
  } else if (nextStatus === "REJECTED") {
    await enqueueJiraCommentSync(admin, approval.org_id, approval.change_event_id, "approval_rejected", {
      reason: comment ?? "Approval rejected",
    });
    await addTimelineEvent({
      supabase,
      orgId: approval.org_id,
      changeEventId: approval.change_event_id,
      actorUserId,
      eventType: "CHANGE_REJECTED",
      title: "Change rejected",
      description: "One or more approvals rejected",
      metadata: {},
    });
    const { data: change } = await admin
      .from("change_events")
      .select("title")
      .eq("id", approval.change_event_id)
      .single();
    await enqueueNotificationEvents(admin, {
      orgId: approval.org_id,
      changeEventId: approval.change_event_id,
      templateKey: "change_rejected",
      payload: { title: change?.title ?? null },
      dedupeKeyBase: `change_rejected:${approval.change_event_id}`,
      channels: ["IN_APP", "SLACK", "EMAIL"],
    });
  }

  return { ok: true, nextStatus };
}
