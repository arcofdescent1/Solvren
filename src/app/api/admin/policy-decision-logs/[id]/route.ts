/**
 * Phase 2 Gap 2 — GET /api/admin/policy-decision-logs/[id].
 */
import { NextRequest, NextResponse } from "next/server";
import { getDecisionLogById } from "@/modules/policy/repositories/policy-decision-logs.repository";
import { authzErrorResponse, resolveResourceInOrg } from "@/lib/server/authz";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await resolveResourceInOrg({
      table: "policy_decision_logs",
      resourceId: id,
      permission: "policy.manage",
    });

    const { data, error } = await getDecisionLogById(ctx.supabase, id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      id: data.id,
      orgId: data.org_id,
      issueId: data.issue_id,
      actionKey: data.action_key,
      playbookKey: data.playbook_key,
      workflowStepKey: data.workflow_step_key,
      evaluationContext: data.evaluation_context_json,
      matchedRules: data.matched_rules_json,
      blockedRules: data.blocked_rules_json,
      approvalRules: data.approval_rules_json,
      finalDisposition: data.final_disposition,
      decisionReasonCode: data.decision_reason_code,
      decisionMessage: data.decision_message,
      effectiveAutonomyMode: data.effective_autonomy_mode,
      requiredApproverRoles: data.required_approver_roles_json,
      requiredApprovalCount: data.required_approval_count,
      appliedExceptionIds: data.applied_exception_ids_json,
      createdAt: data.created_at,
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
