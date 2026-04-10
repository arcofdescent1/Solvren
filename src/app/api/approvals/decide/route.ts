import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { authStateFromUser, requireVerifiedResponse } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canRole } from "@/lib/rbac/permissions";
import { parseOrgRole } from "@/lib/rbac/roles";
import { canReviewDomain } from "@/lib/access/changeAccess";
import { canUserActOnApproval } from "@/lib/approvals/canActOnApproval";
import { runApprovalDecisionPipeline } from "@/lib/approvals/runApprovalDecisionPipeline";
import { queueReadinessRecompute } from "@/lib/readiness/queueRecompute";

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
    .select("id, change_event_id, approver_user_id, delegate_user_id, decision, org_id, domain, approval_area")
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

  const admin = createAdminClient();
  const allowed = await canUserActOnApproval(admin, {
    orgId: approval.org_id,
    approval: {
      approver_user_id: approval.approver_user_id,
      delegate_user_id: (approval as { delegate_user_id?: string | null }).delegate_user_id ?? null,
    },
    actorUserId: userRes.user.id,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Not assigned approver or permitted delegate" },
      { status: 403 }
    );
  }

  const pipeline = await runApprovalDecisionPipeline(supabase, {
    approval: {
      id: approval.id,
      change_event_id: approval.change_event_id,
      approver_user_id: approval.approver_user_id,
      decision: approval.decision,
      org_id: approval.org_id,
      domain: approval.domain,
      approval_area: approval.approval_area,
    },
    actorUserId: userRes.user.id,
    decision: body.decision,
    comment: body.comment ?? null,
    membershipOrgRole: (membership as { role?: string | null } | null)?.role ?? null,
    fromSlack: false,
  });

  if (!pipeline.ok) {
    if (pipeline.code === "REQUIRED_EVIDENCE_MISSING") {
      return NextResponse.json(
        {
          error: pipeline.error,
          code: pipeline.code,
          missingEvidence: pipeline.missingEvidence,
          message: `Missing required evidence: ${(pipeline.missingEvidence ?? []).join(", ")}`,
        },
        { status: pipeline.status }
      );
    }
    if (pipeline.code === "NOT_READY") {
      return NextResponse.json(
        {
          error: pipeline.error,
          code: pipeline.code,
          readyStatus: pipeline.readyStatus,
        },
        { status: pipeline.status }
      );
    }
    if (pipeline.code === "GOVERNANCE_BLOCK") {
      return NextResponse.json(
        {
          error: pipeline.error,
          code: pipeline.code,
          governance: pipeline.governance,
        },
        { status: pipeline.status }
      );
    }
    if (pipeline.code === "GOVERNANCE_REQUIRE_APPROVAL") {
      return NextResponse.json(
        {
          error: pipeline.error,
          code: pipeline.code,
          approvalRequestId: pipeline.approvalRequestId,
          governanceTraceId: pipeline.governanceTraceId,
        },
        { status: pipeline.status }
      );
    }
    if (pipeline.code === "ESCALATED_REQUIRES_EXEC") {
      return NextResponse.json(
        {
          error: pipeline.error,
          code: pipeline.code,
        },
        { status: pipeline.status }
      );
    }
    return NextResponse.json({ error: pipeline.error }, { status: pipeline.status });
  }

  void queueReadinessRecompute({
    orgId: approval.org_id,
    changeEventId: approval.change_event_id,
  });

  return NextResponse.json({ ok: true, nextStatus: pipeline.nextStatus });
}
