/**
 * Phase 1 — Sync orchestrator (§10). Queues and runs backfill / incremental sync jobs.
 * Persists jobs to integration_sync_jobs; delegates execution to provider runtime.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRegistryRuntime } from "../registry";
import type { IntegrationProvider } from "../contracts/types";
import { getAccountById } from "../core/integrationAccountsRepo";
import { insertSyncJob, updateSyncJob } from "../core/integrationSyncJobsRepo";

export type QueueBackfillParams = {
  orgId: string;
  integrationAccountId: string;
  objectTypes?: string[];
  triggerSource: string;
};

export async function queueBackfill(
  supabase: SupabaseClient,
  params: QueueBackfillParams
): Promise<{ jobId: string; error?: string }> {
  const { data: account } = await getAccountById(supabase, params.integrationAccountId);
  if (!account) return { jobId: "", error: "Account not found" };
  if (account.org_id !== params.orgId) return { jobId: "", error: "Forbidden" };

  const { data: job, error: insertErr } = await insertSyncJob(supabase, {
    integration_account_id: params.integrationAccountId,
    job_type: "initial_backfill",
    job_scope: params.objectTypes?.join(",") ?? null,
    status: "queued",
    trigger_source: params.triggerSource,
    cursor_json: {},
    request_json: { objectTypes: params.objectTypes },
    metrics_json: {},
    result_json: {},
    error_json: null,
    started_at: null,
    completed_at: null,
  });
  if (insertErr || !job) return { jobId: "", error: insertErr?.message ?? "Failed to create job" };

  const runtime = getRegistryRuntime(account.provider as IntegrationProvider);
  const result = await runtime.runBackfill({
    orgId: params.orgId,
    integrationAccountId: params.integrationAccountId,
    objectTypes: params.objectTypes,
    triggerSource: params.triggerSource,
  });

  if (result.error) {
    await updateSyncJob(supabase, job.id, {
      status: "failed",
      error_json: { message: result.error },
      completed_at: new Date().toISOString(),
    });
    return { jobId: job.id, error: result.error };
  }

  await updateSyncJob(supabase, job.id, {
    status: result.status,
    started_at: new Date().toISOString(),
  });
  return { jobId: job.id };
}

export type QueueIncrementalSyncParams = {
  orgId: string;
  integrationAccountId: string;
  cursor?: Record<string, unknown>;
  triggerSource: string;
};

export async function queueIncrementalSync(
  supabase: SupabaseClient,
  params: QueueIncrementalSyncParams
): Promise<{ jobId: string; error?: string }> {
  const { data: account } = await getAccountById(supabase, params.integrationAccountId);
  if (!account) return { jobId: "", error: "Account not found" };
  if (account.org_id !== params.orgId) return { jobId: "", error: "Forbidden" };

  const { data: job, error: insertErr } = await insertSyncJob(supabase, {
    integration_account_id: params.integrationAccountId,
    job_type: "incremental_sync",
    job_scope: null,
    status: "queued",
    trigger_source: params.triggerSource,
    cursor_json: params.cursor ?? {},
    request_json: {},
    metrics_json: {},
    result_json: {},
    error_json: null,
    started_at: null,
    completed_at: null,
  });
  if (insertErr || !job) return { jobId: "", error: insertErr?.message ?? "Failed to create job" };

  const runtime = getRegistryRuntime(account.provider as IntegrationProvider);
  const result = await runtime.runIncrementalSync({
    orgId: params.orgId,
    integrationAccountId: params.integrationAccountId,
    cursor: params.cursor,
    triggerSource: params.triggerSource,
  });

  if (result.error) {
    await updateSyncJob(supabase, job.id, {
      status: "failed",
      error_json: { message: result.error },
      completed_at: new Date().toISOString(),
    });
    return { jobId: job.id, error: result.error };
  }

  await updateSyncJob(supabase, job.id, {
    status: result.status,
    started_at: new Date().toISOString(),
    cursor_json: result.nextCursor ?? {},
  });
  return { jobId: job.id };
}

/** Mark a running job as completed (call after async work finishes). */
export async function completeSyncJob(
  supabase: SupabaseClient,
  jobId: string,
  updates: { status: "completed" | "failed"; resultJson?: Record<string, unknown>; errorJson?: unknown; cursorJson?: Record<string, unknown> }
): Promise<{ error?: string }> {
  const { error } = await updateSyncJob(supabase, jobId, {
    status: updates.status,
    completed_at: new Date().toISOString(),
    result_json: updates.resultJson,
    error_json: updates.errorJson,
    cursor_json: updates.cursorJson,
  });
  return { error: error?.message };
}
