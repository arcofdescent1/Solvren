/**
 * Gap 4 — Action execution with idempotency, state machine, retries (§6–9).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRegistryRuntime } from "../registry";
import type { IntegrationProvider } from "../contracts/types";
import { getAccountById } from "../core/integrationAccountsRepo";
import { insertActionLog } from "../core/integrationActionLogsRepo";
import {
  ensureActionExecutionRecord,
  type CreateExecutionInput,
} from "../reliability/services/action-idempotency.service";
import {
  getActionExecution,
  updateActionExecution,
} from "../reliability/repositories/integration-action-executions.repository";
import { assertValidTransition } from "@/modules/execution/services/execution-state-machine";
import {
  getNextRetryAt,
  shouldRetry,
  DEFAULT_MAX_ATTEMPTS,
} from "@/modules/execution/services/retry-orchestrator.service";
import { isRetryable } from "../reliability/services/error-classifier.service";
import {
  recordExecutionSuccess,
  recordExecutionFailure,
} from "../reliability/services/integration-health.service";
import { insertDeadLetter } from "../reliability/repositories/integration-dead-letters.repository";

export type ExecuteActionParams = {
  orgId: string;
  integrationAccountId: string;
  actionKey: string;
  params: Record<string, unknown>;
  issueId?: string | null;
  userId?: string | null;
};

export type ExecuteActionResult = {
  success: boolean;
  executionId?: string;
  externalId?: string;
  message?: string;
  errorCode?: string;
  errorMessage?: string;
  idempotent?: boolean;
  status?: string;
  attemptCount?: number;
  nextRetryAt?: string;
};

function buildTargetRef(params: Record<string, unknown>, issueId?: string | null): Record<string, unknown> {
  const keys = ["invoiceId", "dealId", "customerId", "subscriptionId", "objectId", "projectKey", "channelId"];
  const ref: Record<string, unknown> = {};
  for (const k of keys) {
    if (params[k] != null) ref[k] = params[k];
  }
  if (Object.keys(ref).length === 0 && issueId) ref.issueId = issueId;
  return ref;
}

export async function executeActionWithReliability(
  supabase: SupabaseClient,
  params: ExecuteActionParams
): Promise<ExecuteActionResult> {
  const { data: account } = await getAccountById(supabase, params.integrationAccountId);
  if (!account) return { success: false, errorCode: "not_found", errorMessage: "Account not found" };
  if (account.org_id !== params.orgId) return { success: false, errorCode: "forbidden", errorMessage: "Forbidden" };

  const provider = account.provider as IntegrationProvider;
  const targetRef = buildTargetRef(params.params, params.issueId);

  const ensureInput: CreateExecutionInput = {
    orgId: params.orgId,
    integrationAccountId: params.integrationAccountId,
    provider,
    actionKey: params.actionKey,
    targetRef,
    requestPayload: params.params,
    issueId: params.issueId ?? null,
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
  };

  const ensureResult = await ensureActionExecutionRecord(supabase, ensureInput);
  if ("error" in ensureResult) {
    return { success: false, errorCode: "ensure_failed", errorMessage: ensureResult.error };
  }

  const executionId = ensureResult.executionId;

  if ("existing" in ensureResult && ensureResult.existing) {
    if (["SUCCESS", "VERIFIED"].includes(ensureResult.status)) {
      const { data: exec } = await getActionExecution(supabase, executionId);
      const extId = exec?.provider_response_json as { externalId?: string } | undefined;
      return {
        success: true,
        executionId,
        externalId: extId?.externalId,
        idempotent: true,
        status: ensureResult.status,
      };
    }
    if ("status" in ensureResult && ["FAILED", "DEAD_LETTERED"].includes(ensureResult.status)) {
      return {
        success: false,
        executionId,
        errorCode: "already_failed",
        errorMessage: "Use POST /api/execution/actions/[id]/retry to retry this execution",
        status: ensureResult.status,
      };
    }
  }

  return runExecution(supabase, executionId, params, provider, targetRef);
}

/** Retry a failed execution by ID (used by retry endpoint). */
export async function retryExecutionById(
  supabase: SupabaseClient,
  executionId: string
): Promise<ExecuteActionResult> {
  const { data: exec } = await getActionExecution(supabase, executionId);
  if (!exec) return { success: false, errorCode: "not_found", errorMessage: "Execution not found" };

  const params: ExecuteActionParams = {
    orgId: exec.org_id,
    integrationAccountId: exec.integration_account_id,
    actionKey: exec.action_key,
    params: (exec.request_payload_json ?? {}) as Record<string, unknown>,
    issueId: exec.issue_id,
    userId: null,
  };
  const targetRef = (exec.target_ref_json ?? {}) as Record<string, unknown>;
  const provider = exec.provider as IntegrationProvider;

  return runExecution(supabase, executionId, params, provider, targetRef);
}

async function runExecution(
  supabase: SupabaseClient,
  executionId: string,
  params: ExecuteActionParams,
  provider: IntegrationProvider,
  targetRef: Record<string, unknown>
): Promise<ExecuteActionResult> {
  const { data: exec } = await getActionExecution(supabase, executionId);
  if (!exec) return { success: false, errorCode: "not_found", errorMessage: "Execution record not found" };

  const currentStatus = exec.execution_status as "PENDING" | "EXECUTING" | "RETRYING";
  assertValidTransition(currentStatus, "EXECUTING");

  const attemptCount = (exec.attempt_count ?? 0) + 1;
  await updateActionExecution(supabase, executionId, {
    execution_status: "EXECUTING",
    attempt_count: attemptCount,
  });

  const startMs = Date.now();
  const runtime = getRegistryRuntime(provider);

  try {
    const result = await runtime.executeAction({
      orgId: params.orgId,
      integrationAccountId: params.integrationAccountId,
      actionKey: params.actionKey,
      params: params.params,
      issueId: params.issueId,
      userId: params.userId,
    });

    const latencyMs = Date.now() - startMs;

    if (result.success) {
      assertValidTransition("EXECUTING", "SUCCESS");
      await updateActionExecution(supabase, executionId, {
        execution_status: "SUCCESS",
        provider_response_code: "200",
        provider_response_json: { success: true, externalId: result.externalId } as Record<string, unknown>,
        last_error_code: null,
        last_error_message: null,
        executed_at: new Date().toISOString(),
        next_retry_at: null,
      });
      await recordExecutionSuccess(supabase, params.orgId, provider, latencyMs);
      await insertActionLog(supabase, {
        integration_account_id: params.integrationAccountId,
        provider,
        issue_id: params.issueId ?? null,
        action_type: params.actionKey,
        target_ref_json: targetRef,
        request_json: params.params,
        response_json: { success: true, externalId: result.externalId },
        status: "success",
        retry_count: attemptCount - 1,
        executed_by_user_id: params.userId ?? null,
        executed_at: new Date().toISOString(),
      });
      return {
        success: true,
        executionId,
        externalId: result.externalId,
        message: result.message,
      };
    }

    const errCode = result.errorCode ?? "unknown";
    const errMsg = result.errorMessage ?? "Action failed";
    const retryable = isRetryable(null, errCode, errMsg);
    const maxAttempts = exec.max_attempts ?? DEFAULT_MAX_ATTEMPTS;

    if (retryable && shouldRetry(attemptCount, maxAttempts)) {
      assertValidTransition("EXECUTING", "RETRYING");
      const nextRetry = getNextRetryAt(attemptCount);
      await updateActionExecution(supabase, executionId, {
        execution_status: "RETRYING",
        last_error_code: errCode,
        last_error_message: errMsg,
        provider_response_json: { success: false, errorCode: errCode, errorMessage: errMsg } as Record<string, unknown>,
        next_retry_at: nextRetry.toISOString(),
      });
      await recordExecutionFailure(supabase, params.orgId, provider);
      return {
        success: false,
        executionId,
        errorCode: errCode,
        errorMessage: errMsg,
        status: "RETRYING",
        attemptCount,
        nextRetryAt: nextRetry.toISOString(),
      };
    }

    const finalStatus = attemptCount >= maxAttempts ? "DEAD_LETTERED" : "FAILED";
    assertValidTransition("EXECUTING", finalStatus);
    await updateActionExecution(supabase, executionId, {
      execution_status: finalStatus,
      last_error_code: errCode,
      last_error_message: errMsg,
      provider_response_json: { success: false, errorCode: errCode, errorMessage: errMsg } as Record<string, unknown>,
      next_retry_at: null,
    });
    await recordExecutionFailure(supabase, params.orgId, provider);

    if (finalStatus === "DEAD_LETTERED") {
      await insertDeadLetter(supabase, {
        org_id: params.orgId,
        provider,
        dead_letter_type: "OUTBOUND_ACTION",
        source_record_id: executionId,
        reason_code: errCode,
        reason_message: errMsg,
        payload_json: { actionKey: params.actionKey, params: params.params, issueId: params.issueId },
        retryable: false,
      });
    }

    return {
      success: false,
      executionId,
      errorCode: errCode,
      errorMessage: errMsg,
      status: finalStatus,
      attemptCount,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errCode = err instanceof Error ? (err as { code?: string }).code ?? "runtime_error" : "runtime_error";
    const retryable = isRetryable(null, errCode, errMsg);
    const maxAttempts = exec.max_attempts ?? DEFAULT_MAX_ATTEMPTS;

    await recordExecutionFailure(supabase, params.orgId, provider);

    if (retryable && shouldRetry(attemptCount, maxAttempts)) {
      assertValidTransition("EXECUTING", "RETRYING");
      const nextRetry = getNextRetryAt(attemptCount);
      await updateActionExecution(supabase, executionId, {
        execution_status: "RETRYING",
        last_error_code: errCode,
        last_error_message: errMsg,
        next_retry_at: nextRetry.toISOString(),
      });
      return {
        success: false,
        executionId,
        errorCode: errCode,
        errorMessage: errMsg,
        status: "RETRYING",
        attemptCount,
        nextRetryAt: nextRetry.toISOString(),
      };
    }

    const finalStatus = attemptCount >= maxAttempts ? "DEAD_LETTERED" : "FAILED";
    assertValidTransition("EXECUTING", finalStatus);
    await updateActionExecution(supabase, executionId, {
      execution_status: finalStatus,
      last_error_code: errCode,
      last_error_message: errMsg,
      next_retry_at: null,
    });

    if (finalStatus === "DEAD_LETTERED") {
      await insertDeadLetter(supabase, {
        org_id: params.orgId,
        provider,
        dead_letter_type: "OUTBOUND_ACTION",
        source_record_id: executionId,
        reason_code: errCode,
        reason_message: errMsg,
        payload_json: { actionKey: params.actionKey, params: params.params, issueId: params.issueId },
        retryable: false,
      });
    }

    throw err;
  }
}
