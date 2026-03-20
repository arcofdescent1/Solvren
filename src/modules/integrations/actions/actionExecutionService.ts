/**
 * Phase 1 — Action execution (§12). Executes provider action and logs to integration_action_logs.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRegistryRuntime } from "../registry";
import type { IntegrationProvider } from "../contracts/types";
import { getAccountById } from "../core/integrationAccountsRepo";
import { insertActionLog } from "../core/integrationActionLogsRepo";

export type ExecuteActionParams = {
  orgId: string;
  integrationAccountId: string;
  actionKey: string;
  params: Record<string, unknown>;
  issueId?: string | null;
  userId?: string | null;
};

export async function executeAction(
  supabase: SupabaseClient,
  params: ExecuteActionParams
): Promise<{ success: boolean; externalId?: string; message?: string; errorCode?: string; errorMessage?: string }> {
  const { data: account } = await getAccountById(supabase, params.integrationAccountId);
  if (!account) return { success: false, errorCode: "not_found", errorMessage: "Account not found" };
  if (account.org_id !== params.orgId) return { success: false, errorCode: "forbidden", errorMessage: "Forbidden" };

  const runtime = getRegistryRuntime(account.provider as IntegrationProvider);
  const result = await runtime.executeAction({
    orgId: params.orgId,
    integrationAccountId: params.integrationAccountId,
    actionKey: params.actionKey,
    params: params.params,
    issueId: params.issueId,
    userId: params.userId,
  });

  await insertActionLog(supabase, {
    integration_account_id: params.integrationAccountId,
    provider: account.provider,
    issue_id: params.issueId ?? null,
    action_type: params.actionKey,
    target_ref_json: {},
    request_json: params.params,
    response_json: { success: result.success, externalId: result.externalId, message: result.message, errorCode: result.errorCode, errorMessage: result.errorMessage },
    status: result.success ? "success" : "failed",
    retry_count: 0,
    executed_by_user_id: params.userId ?? null,
    executed_at: new Date().toISOString(),
  });

  return {
    success: result.success,
    externalId: result.externalId,
    message: result.message,
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
  };
}
