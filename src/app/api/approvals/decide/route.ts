import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getReadyStatus } from "@/services/risk/readyStatus";
import { auditLog } from "@/lib/audit";
import { authStateFromUser, requireVerifiedResponse } from "@/lib/auth";
import { addTimelineEvent } from "@/services/timeline/addTimelineEvent";
import { enqueueNotificationEvents } from "@/services/notifications/createNotifications";
import { enqueueJiraIssuePropertySync, enqueueJiraCommentSync } from "@/services/jira/jiraSyncService";
import { createAdminClient } from "@/lib/supabase/admin";
import { canRole } from "@/lib/rbac/permissions";
import { parseOrgRole } from "@/lib/rbac/roles";
import { canReviewDomain } from "@/lib/access/changeAccess";
import {
  evaluateGovernance,
  bindGovernanceApprovalRequest,
  deploymentGovernanceEnvironment,
} from "@/modules/governance";

type Body = {
  approvalId: string;
  decision: "APPROVED" | "REJECTED";
  comment?: string | null;
};

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = requireVerifiedResponse(authStateFromUser(userRes.user));
  if (forbidden) return forbidden;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.approvalId)
    return NextResponse.json({ error: "Missing approvalId" }, { status: 400 });

  const { data: approval, error: aErr } = await supabase
    .from("approvals")
    .select("id, change_event_id, approver_user_id, decision, org_id, domain, approval_area")
    .eq("id", body.approvalId)
    .single();

  if (aErr || !approval)
    return NextResponse.json(
      { error: aErr?.message ?? "Not found" },
      { status: 404 }
    );

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", approval.org_id)
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  const orgRole = parseOrgRole((membership as { role?: string | null } | null)?.role ?? null);
  if (!canRole(orgRole, "change.approve")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const canReview = await canReviewDomain(supabase, userRes.user.id, approval.org_id, approval.domain);
  if (!canReview) {
    return NextResponse.json(
      { error: "You do not have review permission for this domain." },
      { status: 403 }
    );
  }

  if (approval.approver_user_id !== userRes.user.id) {
    return NextResponse.json(
      { error: "Not assigned approver" },
      { status: 403 }
    );
  }

  // Idempotency: don't overwrite already decided approvals
  if (approval.decision !== "PENDING") {
    const { data: ce } = await scopeActiveChangeEvents(supabase.from("change_events").select("status"))
      .eq("id", approval.change_event_id)
      .maybeSingle();
    return NextResponse.json({
      ok: true,
      nextStatus: ce?.status ?? "IN_REVIEW",
    });
  }

  // Enforce full readiness gating: block APPROVE when not ready (evidence, approvals, incidents).
  if (body.decision === "APPROVED") {
    try {
      const readyStatus = await getReadyStatus(supabase, {
        changeId: approval.change_event_id,
      });
      if (!readyStatus.ready) {
        const missingEvidence = readyStatus.missingEvidence ?? [];
        if (readyStatus.approvalBlockedMissingEvidence && missingEvidence.length > 0) {
          await auditLog(supabase, {
            orgId: approval.org_id,
            actorId: userRes.user.id,
            action: "approval_blocked_missing_evidence",
            entityType: "change",
            entityId: approval.change_event_id,
            metadata: {
              missingEvidence,
              code: "REQUIRED_EVIDENCE_MISSING",
            },
          });
          return NextResponse.json(
            {
              error: "Cannot approve. Missing required evidence.",
              code: "REQUIRED_EVIDENCE_MISSING",
              missingEvidence,
              message: `Missing required evidence: ${missingEvidence.join(", ")}`,
            },
            { status: 400 }
          );
        }
        return NextResponse.json(
          {
            error: "Change is not ready for approval",
            code: "NOT_READY",
            readyStatus,
          },
          { status: 400 }
        );
      }
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Ready check failed" },
        { status: 500 }
      );
    }
  }

  // (Optional) Gate approval when SLA is escalated — Item 4 meets Approval Control Plane.
  // When sla_status === "ESCALATED", require extra approval tier (e.g. EXEC / RISK_OWNER).
  const { data: ceSla } = await scopeActiveChangeEvents(supabase.from("change_events").select("sla_status, org_id, domain"))
    .eq("id", approval.change_event_id)
    .maybeSingle();
  if (body.decision === "APPROVED" && ceSla?.sla_status === "ESCALATED") {
    // Enforce: escalated changes MUST have an EXEC approval assigned.
    const { data: execAppr, error: execErr } = await supabase
      .from("approvals")
      .select("id")
      .eq("change_event_id", approval.change_event_id)
      .eq("approval_area", "EXEC")
      .limit(1)
      .maybeSingle();

    if (execErr) {
      return NextResponse.json({ error: execErr.message }, { status: 500 });
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
        return NextResponse.json({ error: roleErr.message }, { status: 500 });
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
          return NextResponse.json({ error: memErr.message }, { status: 500 });
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
          return NextResponse.json({ error: anyErr.message }, { status: 500 });
        }
        execUserId = String((anyMember as { user_id?: string } | null)?.user_id ?? "");
      }

      if (!execUserId) {
        return NextResponse.json(
          { error: "Escalated approval requires an EXEC approver, but no org members were found." },
          { status: 400 }
        );
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
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }

      await auditLog(supabase, {
        orgId,
        changeEventId: approval.change_event_id,
        actorId: userRes.user.id,
        action: "approval_assigned_escalated",
        entityType: "change",
        entityId: approval.change_event_id,
        metadata: { approval_area: "EXEC" },
      });

      return NextResponse.json(
        {
          error: "SLA is escalated. An EXEC approval has been assigned and is now required.",
          code: "ESCALATED_REQUIRES_EXEC",
        },
        { status: 400 }
      );
    }
  }

  if (body.decision === "APPROVED") {
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

    const roleKeys = (membership as { role?: string | null } | null)?.role
      ? [String((membership as { role: string }).role)]
      : undefined;

    const {
      data: govApprove,
      policyContext: govApproveCtx,
      error: govApproveErr,
    } = await evaluateGovernance(supabase, {
      orgId: approval.org_id,
      environment: deploymentGovernanceEnvironment(),
      actor: {
        userId: userRes.user.id,
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
      return NextResponse.json(
        { error: govApproveErr?.message ?? "Governance evaluation failed" },
        { status: 500 }
      );
    }
    if (govApprove.disposition === "BLOCK") {
      await auditLog(supabase, {
        orgId: approval.org_id,
        changeEventId: approval.change_event_id,
        actorId: userRes.user.id,
        action: "approval_blocked_governance",
        entityType: "change",
        entityId: approval.change_event_id,
        metadata: {
          traceId: govApprove.traceId,
          reasonCodes: govApprove.reasonCodes,
        },
      });
      return NextResponse.json(
        {
          error: govApprove.explainability.headline,
          code: "GOVERNANCE_BLOCK",
          governance: {
            traceId: govApprove.traceId,
            disposition: govApprove.disposition,
            reasonCodes: govApprove.reasonCodes,
          },
        },
        { status: 403 }
      );
    }
    if (govApprove.disposition === "REQUIRE_APPROVAL") {
      if (!govApproveCtx) {
        return NextResponse.json(
          { error: "Governance requires approval but context was not available" },
          { status: 500 }
        );
      }
      const { approvalRequestId, error: bindApprErr } = await bindGovernanceApprovalRequest(
        supabase,
        govApprove,
        govApproveCtx,
        { createdByUserId: userRes.user.id, createdByType: "user" }
      );
      await auditLog(supabase, {
        orgId: approval.org_id,
        changeEventId: approval.change_event_id,
        actorId: userRes.user.id,
        action: "approval_deferred_governance_policy",
        entityType: "change",
        entityId: approval.change_event_id,
        metadata: {
          governanceTraceId: govApprove.traceId,
          policyApprovalRequestId: approvalRequestId,
          bindError: bindApprErr?.message,
        },
      });
      return NextResponse.json(
        {
          error:
            govApprove.explainability.headline ||
            "Additional policy approval is required before this approval can be recorded",
          code: "GOVERNANCE_REQUIRE_APPROVAL",
          approvalRequestId,
          governanceTraceId: govApprove.traceId,
        },
        { status: 403 }
      );
    }
  }

  // Now it's safe to persist the approval decision
  const { error: updErr } = await supabase
    .from("approvals")
    .update({
      decision: body.decision,
      comment: body.comment ?? null,
      decided_at: new Date().toISOString(),
    })
    .eq("id", approval.id);

  if (updErr)
    return NextResponse.json({ error: updErr.message }, { status: 500 });

  await auditLog(supabase, {
    orgId: approval.org_id,
    changeEventId: approval.change_event_id,
    actorId: userRes.user.id,
    action: body.decision === "APPROVED" ? "approval_granted" : "approval_rejected",
    entityType: "approval",
    entityId: approval.id,
    metadata: {
      change_event_id: approval.change_event_id,
      approval_area: approval.approval_area ?? null,
      comment: body.comment ?? null,
    },
  });

  await addTimelineEvent({
    supabase,
    orgId: approval.org_id,
    changeEventId: approval.change_event_id,
    actorUserId: userRes.user.id,
    eventType: body.decision === "APPROVED" ? "APPROVAL_APPROVED" : "APPROVAL_REJECTED",
    title: body.decision === "APPROVED" ? "Approval given" : "Approval rejected",
    description: `${approval.approval_area ?? "Approval"} – ${body.decision}`,
    metadata: {
      approval_area: approval.approval_area ?? null,
      domain: approval.domain ?? null,
      comment: body.comment ?? null,
    },
  });

  // Re-check approvals state to set change status
  const { data: all2, error: allErr2 } = await supabase
    .from("approvals")
    .select("decision")
    .eq("change_event_id", approval.change_event_id);

  if (allErr2)
    return NextResponse.json({ error: allErr2.message }, { status: 500 });

  const anyRejected = (all2 ?? []).some((x) => x.decision === "REJECTED");
  const allApproved =
    (all2 ?? []).length > 0 &&
    (all2 ?? []).every((x) => x.decision === "APPROVED");

  const nextStatus = anyRejected
    ? "REJECTED"
    : allApproved
      ? "APPROVED"
      : "IN_REVIEW";

  const { error: ceUpdErr } = await supabase
    .from("change_events")
    .update({ status: nextStatus })
    .eq("id", approval.change_event_id);

  if (ceUpdErr)
    return NextResponse.json({ error: ceUpdErr.message }, { status: 500 });

  await auditLog(supabase, {
    orgId: approval.org_id,
    changeEventId: approval.change_event_id,
    actorId: userRes.user.id,
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
      actorUserId: userRes.user.id,
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
      reason: body.comment ?? "Approval rejected",
    });
    await addTimelineEvent({
      supabase,
      orgId: approval.org_id,
      changeEventId: approval.change_event_id,
      actorUserId: userRes.user.id,
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

  return NextResponse.json({ ok: true, nextStatus });
}
