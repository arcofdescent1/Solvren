/**
 * Gap 4 — Manual retry of failed/dead-lettered action execution (§13.2).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getActionExecution, updateActionExecution } from "../reliability/repositories/integration-action-executions.repository";
import { assertValidTransition } from "@/modules/execution/services/execution-state-machine";
import type { ExecuteActionResult } from "./actionExecutionWithReliability";
import { retryExecutionById } from "./actionExecutionWithReliability";

export async function retryActionExecution(
  supabase: SupabaseClient,
  executionId: string
): Promise<ExecuteActionResult> {
  const { data: exec, error } = await getActionExecution(supabase, executionId);
  if (error || !exec) {
    return { success: false, errorCode: "not_found", errorMessage: "Execution not found" };
  }

  const status = exec.execution_status as string;
  if (!["FAILED", "DEAD_LETTERED"].includes(status)) {
    return {
      success: false,
      executionId,
      errorCode: "invalid_state",
      errorMessage: `Cannot retry execution in state ${status}. Only FAILED or DEAD_LETTERED can be retried.`,
      status,
    };
  }

  assertValidTransition(status as "FAILED" | "DEAD_LETTERED", "PENDING");
  await updateActionExecution(supabase, executionId, {
    execution_status: "PENDING",
    attempt_count: 0,
    last_error_code: null,
    last_error_message: null,
    next_retry_at: null,
  });

  return retryExecutionById(supabase, executionId);
}
