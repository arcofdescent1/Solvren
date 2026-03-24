/**
 * Phase 4 — Action execution idempotency (§11.1).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  insertActionExecution,
  findActionExecutionByIdempotencyKey,
} from "../repositories/integration-action-executions.repository";
import { deriveOutboundIdempotencyKey } from "./idempotency.service";

export type CreateExecutionInput = {
  orgId: string;
  integrationAccountId: string;
  provider: string;
  actionKey: string;
  targetRef: Record<string, unknown>;
  requestPayload: Record<string, unknown>;
  issueId?: string | null;
  workflowRunId?: string | null;
  riskLevel?: string | null;
  maxAttempts?: number;
  reconciliationRequired?: boolean;
  governanceTraceId?: string | null;
};

export type CreateExecutionResult =
  | { created: true; executionId: string }
  | { existing: true; executionId: string; status: string }
  | { error: string };

export async function ensureActionExecutionRecord(
  supabase: SupabaseClient,
  input: CreateExecutionInput
): Promise<CreateExecutionResult> {
  const idempotencyKey = deriveOutboundIdempotencyKey({
    org_id: input.orgId,
    provider: input.provider,
    action_key: input.actionKey,
    target_ref: input.targetRef,
    request_payload: input.requestPayload,
    issue_id: input.issueId,
    workflow_run_id: input.workflowRunId,
  });

  const { data: existing } = await findActionExecutionByIdempotencyKey(
    supabase,
    input.orgId,
    input.provider,
    idempotencyKey
  );

  if (existing) {
    return { existing: true, executionId: existing.id, status: existing.execution_status };
  }

  const { data, error } = await insertActionExecution(supabase, {
    org_id: input.orgId,
    integration_account_id: input.integrationAccountId,
    issue_id: input.issueId,
    workflow_run_id: input.workflowRunId,
    provider: input.provider,
    action_key: input.actionKey,
    target_ref_json: input.targetRef,
    request_payload_json: input.requestPayload,
    idempotency_key: idempotencyKey,
    risk_level: input.riskLevel,
    max_attempts: input.maxAttempts ?? 5,
    reconciliation_required: input.reconciliationRequired ?? false,
    governance_trace_id: input.governanceTraceId ?? null,
  });

  if (error) return { error: error.message };
  if (!data) return { error: "Insert returned no data" };
  return { created: true, executionId: data.id };
}
