/**
 * Phase 1 + Gap 4 — Action execution with idempotency, state machine, retries.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { executeActionWithReliability } from "./actionExecutionWithReliability";

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
  externalId?: string;
  executionId?: string;
  message?: string;
  errorCode?: string;
  errorMessage?: string;
};

export async function executeAction(
  supabase: SupabaseClient,
  params: ExecuteActionParams
): Promise<ExecuteActionResult> {
  const result = await executeActionWithReliability(supabase, params);
  return {
    success: result.success,
    externalId: result.externalId,
    executionId: result.executionId,
    message: result.message,
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
  };
}
