/**
 * Phase 6 Deep Expansion — Create execution task with idempotency and write-back (§14).
 * Phase 6 — Resume after policy approval: pass policyApprovalRequestId + same idempotency key when writeback_status was pending_approval.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { insertExecutionTask, findTaskByIdempotencyKey } from "../persistence/execution-tasks.repository";
import { insertIssueAction } from "../persistence/issue-actions.repository";
import { executeAction } from "@/modules/integrations";
import { preExecutionCheck } from "@/modules/policy/enforcement/preExecutionCheck";
import { resolveGovernanceTraceFromApprovedPolicyRequest } from "@/modules/policy/repositories/approval-requests.repository";
import { getAccountByOrgAndProvider } from "@/modules/integrations/core/integrationAccountsRepo";
import { getAction, getManifestActionKey } from "../registry/action-registry";

export type CreateExecutionTaskInput = {
  orgId: string;
  issueId: string;
  taskType: string;
  externalSystem: string;
  requestedByUserId: string | null;
  params: Record<string, unknown>;
  executeImmediately?: boolean;
  idempotencyKey?: string;
  executionMode?: "manual" | "suggested" | "auto";
  /**
   * Resolved policy `approval_requests` row (status approved). Use on retry after approval so
   * `integration_action_executions.governance_trace_id` points at the original decision log.
   */
  policyApprovalRequestId?: string | null;
};

export type CreateExecutionTaskResult =
  | { ok: true; taskId: string; actionId: string; externalId?: string; idempotent?: boolean }
  | { ok: false; error: string };

async function persistWritebackOutcome(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    issueId: string;
    taskId: string;
    actionId: string;
    taskType: string;
    result: {
      success: boolean;
      externalId?: string;
      errorCode?: string;
      errorMessage?: string;
    };
  }
): Promise<CreateExecutionTaskResult> {
  const executedAt = new Date().toISOString();
  const success = input.result.success;
  const wbStatus = success ? "success" : "failed";

  await supabase
    .from("issue_actions")
    .update({
      action_status: success ? "done" : "failed",
      target_ref: input.result.externalId ?? null,
      response_json: { success, externalId: input.result.externalId },
      error_json: success ? null : { message: input.result.errorMessage, code: input.result.errorCode },
      executed_at: executedAt,
    })
    .eq("id", input.actionId);

  await supabase
    .from("execution_tasks")
    .update({
      status: success ? "done" : "failed",
      external_task_id: input.result.externalId ?? null,
      sync_status: success ? "synced" : "failed",
      writeback_status: wbStatus,
      updated_at: executedAt,
    })
    .eq("id", input.taskId);

  if (success) {
    const { recordOutcomeFromAction, inferOutcomeTypeFromAction } = await import(
      "@/modules/outcomes/application/recordOutcomeFromAction"
    );
    const { data: impactRow } = await supabase
      .from("issue_impact_summaries")
      .select("current_revenue_at_risk_amount, current_confidence_score")
      .eq("issue_id", input.issueId)
      .maybeSingle();
    const revenueAtRisk =
      Number((impactRow as { current_revenue_at_risk_amount?: number } | null)?.current_revenue_at_risk_amount) || 0;
    const confidence = Number((impactRow as { current_confidence_score?: number } | null)?.current_confidence_score) || 0.8;
    if (revenueAtRisk > 0) {
      const attributedAmount = Math.round(revenueAtRisk * 0.7);
      recordOutcomeFromAction(supabase, {
        orgId: input.orgId,
        issueId: input.issueId,
        actionId: input.actionId,
        actionType: input.taskType,
        amount: attributedAmount,
        outcomeType: inferOutcomeTypeFromAction(input.taskType),
        confidenceScore: confidence,
        evidence: { external_id: input.result.externalId },
      }).catch((err) => console.error("[Phase7] recordOutcomeFromAction:", err));
    }
  }

  return {
    ok: true,
    taskId: input.taskId,
    actionId: input.actionId,
    externalId: input.result.externalId,
  };
}

export async function createExecutionTask(
  supabase: SupabaseClient,
  input: CreateExecutionTaskInput
): Promise<CreateExecutionTaskResult> {
  const idempotencyKey = input.idempotencyKey ?? buildIdempotencyKey(input.orgId, input.taskType, input.issueId, input.params);
  const manifestActionKey = getManifestActionKey(input.taskType);
  const actionKeyForPolicy = input.taskType.includes(".") ? input.taskType : `${input.externalSystem}.${input.taskType}`;

  if (idempotencyKey) {
    const { data: existing } = await findTaskByIdempotencyKey(supabase, idempotencyKey);
    if (existing) {
      const resumeAfterPolicyApproval =
        input.executeImmediately &&
        !!input.policyApprovalRequestId &&
        existing.writeback_status === "pending_approval" &&
        existing.issue_id === input.issueId &&
        existing.external_system === input.externalSystem &&
        existing.task_type === input.taskType;

      if (!resumeAfterPolicyApproval) {
        const { data: actions } = await supabase
          .from("issue_actions")
          .select("id")
          .eq("issue_id", existing.issue_id)
          .eq("action_type", existing.task_type)
          .eq("external_system", existing.external_system)
          .order("created_at", { ascending: false })
          .limit(1);
        const actionId = (actions?.[0] as { id: string } | undefined)?.id ?? existing.id;
        return {
          ok: true,
          taskId: existing.id,
          actionId,
          externalId: existing.external_task_id ?? undefined,
          idempotent: true,
        };
      }

      const traceRes = await resolveGovernanceTraceFromApprovedPolicyRequest(supabase, {
        approvalRequestId: input.policyApprovalRequestId!,
        orgId: input.orgId,
        issueId: input.issueId,
        actionKeyForPolicy,
      });
      if ("error" in traceRes) {
        return { ok: false, error: traceRes.error };
      }

      const { data: account } = await getAccountByOrgAndProvider(supabase, input.orgId, input.externalSystem);
      if (!account) {
        return { ok: false, error: "Integration account not found" };
      }

      const { data: actions } = await supabase
        .from("issue_actions")
        .select("id")
        .eq("issue_id", existing.issue_id)
        .eq("action_type", existing.task_type)
        .eq("external_system", existing.external_system)
        .order("created_at", { ascending: false })
        .limit(1);
      const actionId = (actions?.[0] as { id: string } | undefined)?.id;
      if (!actionId) {
        return { ok: false, error: "Could not resolve issue action for resumed execution" };
      }

      const result = await executeAction(supabase, {
        orgId: input.orgId,
        integrationAccountId: account.id,
        actionKey: manifestActionKey,
        policyAlreadyEnforced: true,
        governanceTraceId: traceRes.governanceTraceId,
        params: input.params,
        issueId: input.issueId,
        userId: input.requestedByUserId,
      });

      return persistWritebackOutcome(supabase, {
        orgId: input.orgId,
        issueId: input.issueId,
        taskId: existing.id,
        actionId,
        taskType: input.taskType,
        result,
      });
    }
  }

  const actionDef = getAction(input.taskType, input.externalSystem);
  const writebackStatus = input.executeImmediately ? "executing" : "pending";

  const { data: action, error: actionErr } = await insertIssueAction(supabase, {
    issue_id: input.issueId,
    action_type: input.taskType,
    action_status: input.executeImmediately ? "pending" : "queued",
    requested_by: input.requestedByUserId,
    external_system: input.externalSystem,
    target_ref: null,
    request_json: input.params,
    response_json: null,
    error_json: null,
    executed_at: null,
    created_at: new Date().toISOString(),
  });

  if (actionErr || !action) {
    return { ok: false, error: actionErr?.message ?? "Failed to create action" };
  }

  const { data: task, error: taskErr } = await insertExecutionTask(supabase, {
    issue_id: input.issueId,
    external_system: input.externalSystem,
    external_task_id: null,
    task_type: input.taskType,
    status: "pending",
    assignee_ref: null,
    due_at: null,
    sync_status: null,
    idempotency_key: idempotencyKey || null,
    writeback_status: writebackStatus,
    execution_mode: input.executionMode ?? "manual",
  });

  if (taskErr || !task) {
    return { ok: false, error: taskErr?.message ?? "Failed to create task" };
  }

  if (input.executeImmediately) {
    const { data: account } = await getAccountByOrgAndProvider(supabase, input.orgId, input.externalSystem);
    if (!account) {
      await supabase
        .from("execution_tasks")
        .update({ writeback_status: "failed", updated_at: new Date().toISOString() })
        .eq("id", task.id);
      return { ok: true, taskId: task.id, actionId: action.id };
    }

    if (input.policyApprovalRequestId) {
      const traceRes = await resolveGovernanceTraceFromApprovedPolicyRequest(supabase, {
        approvalRequestId: input.policyApprovalRequestId,
        orgId: input.orgId,
        issueId: input.issueId,
        actionKeyForPolicy,
      });
      if ("error" in traceRes) {
        await supabase
          .from("execution_tasks")
          .update({ writeback_status: "failed", status: "failed", updated_at: new Date().toISOString() })
          .eq("id", task.id);
        await supabase
          .from("issue_actions")
          .update({
            action_status: "failed",
            error_json: { message: traceRes.error, code: "POLICY_APPROVAL_INVALID" },
          })
          .eq("id", action.id);
        return { ok: false, error: traceRes.error };
      }

      const result = await executeAction(supabase, {
        orgId: input.orgId,
        integrationAccountId: account.id,
        actionKey: manifestActionKey,
        policyAlreadyEnforced: true,
        governanceTraceId: traceRes.governanceTraceId,
        params: input.params,
        issueId: input.issueId,
        userId: input.requestedByUserId,
      });

      return persistWritebackOutcome(supabase, {
        orgId: input.orgId,
        issueId: input.issueId,
        taskId: task.id,
        actionId: action.id,
        taskType: input.taskType,
        result,
      });
    }

    const policyCheck = await preExecutionCheck(supabase, {
      orgId: input.orgId,
      actionKey: actionKeyForPolicy,
      issueId: input.issueId,
      requestedMode: input.executionMode === "auto" ? "auto_execute_low_risk" : "approve_then_execute",
      actorUserId: input.requestedByUserId,
      provider: input.externalSystem,
    });
    if ("blocked" in policyCheck && policyCheck.blocked) {
      const reason = policyCheck.reason;
      await supabase
        .from("execution_tasks")
        .update({ writeback_status: "failed", status: "failed", updated_at: new Date().toISOString() })
        .eq("id", task.id);
      await supabase
        .from("issue_actions")
        .update({ action_status: "failed", error_json: { message: reason, code: "POLICY_BLOCKED" } })
        .eq("id", action.id);
      return { ok: false, error: reason };
    }
    if ("requiresApproval" in policyCheck && policyCheck.requiresApproval) {
      const approvalRequestId = policyCheck.approvalRequestId;
      await supabase
        .from("execution_tasks")
        .update({ writeback_status: "pending_approval", updated_at: new Date().toISOString() })
        .eq("id", task.id);
      return { ok: false, error: `Approval required. Request ID: ${approvalRequestId}` };
    }

    const traceId = "allowed" in policyCheck && policyCheck.allowed ? policyCheck.governanceTraceId : null;
    const result = await executeAction(supabase, {
      orgId: input.orgId,
      integrationAccountId: account.id,
      actionKey: manifestActionKey,
      policyAlreadyEnforced: true,
      governanceTraceId: traceId,
      params: input.params,
      issueId: input.issueId,
      userId: input.requestedByUserId,
    });

    return persistWritebackOutcome(supabase, {
      orgId: input.orgId,
      issueId: input.issueId,
      taskId: task.id,
      actionId: action.id,
      taskType: input.taskType,
      result,
    });
  }

  return { ok: true, taskId: task.id, actionId: action.id };
}

function buildIdempotencyKey(orgId: string, actionKey: string, issueId: string, params: Record<string, unknown>): string {
  const targetId = (params.invoiceId ?? params.dealId ?? params.customerId ?? params.subscriptionId ?? issueId) as string;
  return `${orgId}:${actionKey}:${targetId}`;
}
