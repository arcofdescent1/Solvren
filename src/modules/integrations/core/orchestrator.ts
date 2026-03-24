/**
 * Phase 2 — Integration orchestrator.
 * Routes execution to provider runtimes. Enforces mapping usage.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRegistryRuntime } from "../registry";
import type { IntegrationProvider } from "../contracts/types";
import { getAccountById } from "./integrationAccountsRepo";
import type {
  ConnectStartInput,
  ConnectStartResult,
  ConnectCallbackInput,
  ConnectCallbackResult,
  DisconnectInput,
  RefreshAuthInput,
  RefreshAuthResult,
  TestConnectionInput,
  TestConnectionResult,
  GetHealthInput,
  IntegrationHealthReport,
  FetchSchemaInput,
  ProviderSchemaResult,
  RunBackfillInput,
  BackfillResult,
  RunIncrementalSyncInput,
  IncrementalSyncResult,
  ReceiveWebhookInput,
  WebhookReceiptResult,
  ReconcileWebhookInput,
  ReconcileWebhookResult,
  ExecuteActionInput,
  ActionExecutionResult,
} from "../contracts/runtime";

export type OrchestratorContext = {
  supabase: SupabaseClient;
};

/**
 * Route connect start to provider runtime.
 */
export async function orchestrateConnectStart(
  _ctx: OrchestratorContext,
  input: ConnectStartInput & { provider?: IntegrationProvider }
): Promise<ConnectStartResult> {
  const provider = input.provider ?? "hubspot";
  const runtime = getRegistryRuntime(provider);
  return runtime.connect(input);
}

/**
 * Route connect callback to provider runtime.
 */
export async function orchestrateConnectCallback(
  _ctx: OrchestratorContext,
  input: ConnectCallbackInput
): Promise<ConnectCallbackResult> {
  const runtime = getRegistryRuntime(input.provider);
  return runtime.handleCallback(input);
}

/**
 * Route disconnect to provider runtime.
 */
export async function orchestrateDisconnect(
  ctx: OrchestratorContext,
  input: DisconnectInput
): Promise<void> {
  const { data: account } = await getAccountById(ctx.supabase, input.integrationAccountId);
  if (!account) return;
  const runtime = getRegistryRuntime(account.provider as IntegrationProvider);
  await runtime.disconnect(input);
}

/**
 * Route refresh auth to provider runtime.
 */
export async function orchestrateRefreshAuth(
  ctx: OrchestratorContext,
  input: RefreshAuthInput
): Promise<RefreshAuthResult> {
  const { data: account } = await getAccountById(ctx.supabase, input.integrationAccountId);
  if (!account) return { success: false, errorCode: "not_found", errorMessage: "Account not found" };
  const runtime = getRegistryRuntime(account.provider as IntegrationProvider);
  return runtime.refreshAuth(input);
}

/**
 * Route test connection to provider runtime.
 */
export async function orchestrateTestConnection(
  ctx: OrchestratorContext,
  input: TestConnectionInput
): Promise<TestConnectionResult> {
  const { data: account } = await getAccountById(ctx.supabase, input.integrationAccountId);
  if (!account) return { success: false, message: "Account not found" };
  const runtime = getRegistryRuntime(account.provider as IntegrationProvider);
  return runtime.testConnection(input);
}

/**
 * Route get health to provider runtime.
 */
export async function orchestrateGetHealth(
  ctx: OrchestratorContext,
  input: GetHealthInput
): Promise<IntegrationHealthReport> {
  const { data: account } = await getAccountById(ctx.supabase, input.integrationAccountId);
  if (!account) {
    return {
      status: "unhealthy",
      dimensions: {},
      lastCheckedAt: new Date().toISOString(),
    };
  }
  const runtime = getRegistryRuntime(account.provider as IntegrationProvider);
  return runtime.getHealth(input);
}

/**
 * Route fetch schema to provider runtime.
 */
export async function orchestrateFetchSchema(
  ctx: OrchestratorContext,
  input: FetchSchemaInput
): Promise<ProviderSchemaResult> {
  const { data: account } = await getAccountById(ctx.supabase, input.integrationAccountId);
  if (!account) return { objectTypes: [], error: "Account not found" };
  const runtime = getRegistryRuntime(account.provider as IntegrationProvider);
  return runtime.fetchSchema(input);
}

/**
 * Route backfill to provider runtime.
 */
export async function orchestrateRunBackfill(
  ctx: OrchestratorContext,
  input: RunBackfillInput
): Promise<BackfillResult> {
  const { data: account } = await getAccountById(ctx.supabase, input.integrationAccountId);
  if (!account) return { jobId: "", status: "queued", error: "Account not found" };
  const runtime = getRegistryRuntime(account.provider as IntegrationProvider);
  return runtime.runBackfill(input);
}

/**
 * Route incremental sync to provider runtime.
 */
export async function orchestrateRunIncrementalSync(
  ctx: OrchestratorContext,
  input: RunIncrementalSyncInput
): Promise<IncrementalSyncResult> {
  const { data: account } = await getAccountById(ctx.supabase, input.integrationAccountId);
  if (!account) return { jobId: "", status: "queued", error: "Account not found" };
  const runtime = getRegistryRuntime(account.provider as IntegrationProvider);
  return runtime.runIncrementalSync(input);
}

/**
 * Route webhook receive to provider runtime.
 * All ingestion must go: raw → mapping engine → canonical.
 */
export async function orchestrateReceiveWebhook(
  input: ReceiveWebhookInput
): Promise<WebhookReceiptResult> {
  const runtime = getRegistryRuntime(input.provider as IntegrationProvider);
  return runtime.receiveWebhook(input);
}

/**
 * Route webhook reconcile to provider runtime.
 */
export async function orchestrateReconcileWebhooks(
  ctx: OrchestratorContext,
  input: ReconcileWebhookInput
): Promise<ReconcileWebhookResult> {
  const { data: account } = await getAccountById(ctx.supabase, input.integrationAccountId);
  if (!account) return { success: false, error: "Account not found" };
  const runtime = getRegistryRuntime(account.provider as IntegrationProvider);
  return runtime.reconcileWebhooks(input);
}

/**
 * Route action execution to provider runtime.
 */
export async function orchestrateExecuteAction(
  ctx: OrchestratorContext,
  input: ExecuteActionInput
): Promise<ActionExecutionResult> {
  const { data: account } = await getAccountById(ctx.supabase, input.integrationAccountId);
  if (!account) return { success: false, errorCode: "not_found", errorMessage: "Account not found" };
  const runtime = getRegistryRuntime(account.provider as IntegrationProvider);
  return runtime.executeAction(input);
}
