/**
 * Phase 3 — Schedule orchestrator: find due schedules, queue syncs.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getNextRunAt } from "./cronResolver";
import { getCheckpoint } from "./checkpointManager";
import { getRegistryRuntime, hasProvider } from "../registry";
import { getAccountById } from "../core/integrationAccountsRepo";
import type { IntegrationProvider } from "../contracts/types";

export type DueScheduleRow = {
  id: string;
  org_id: string;
  integration_account_id: string;
  job_type: string;
  cron_expression: string;
  timezone: string;
};

export async function getDueSchedules(
  supabase: SupabaseClient,
  asOf: Date = new Date()
): Promise<DueScheduleRow[]> {
  const { data } = await supabase
    .from("integration_sync_schedules")
    .select("id, org_id, integration_account_id, job_type, cron_expression, timezone")
    .eq("enabled", true)
    .lte("next_run_at", asOf.toISOString());

  return (data ?? []) as DueScheduleRow[];
}

export async function executeDueSchedule(
  supabase: SupabaseClient,
  scheduleId: string
): Promise<{ ok: boolean; error?: string }> {
  const { data: schedule, error: sErr } = await supabase
    .from("integration_sync_schedules")
    .select("*")
    .eq("id", scheduleId)
    .single();

  if (sErr || !schedule) return { ok: false, error: "Schedule not found" };

  const row = schedule as {
    integration_account_id: string;
    org_id: string;
    job_type: string;
    cron_expression: string;
    timezone: string;
  };

  const { data: account } = await getAccountById(supabase, row.integration_account_id);
  if (!account) return { ok: false, error: "Account not found" };

  if (!hasProvider(account.provider)) {
    return { ok: false, error: `Unknown provider: ${account.provider}` };
  }

  const runtime = getRegistryRuntime(account.provider as IntegrationProvider);
  const checkpoint = await getCheckpoint(supabase, {
    integrationAccountId: row.integration_account_id,
    sourceObjectType: row.job_type === "initial_backfill" ? "backfill" : "incremental",
  });

  const result =
    row.job_type === "initial_backfill"
      ? await runtime.runBackfill({
          orgId: row.org_id,
          integrationAccountId: row.integration_account_id,
          triggerSource: "schedule",
        })
      : await runtime.runIncrementalSync({
          orgId: row.org_id,
          integrationAccountId: row.integration_account_id,
          cursor: checkpoint.checkpoint ?? undefined,
          triggerSource: "schedule",
        });

  if (result.error) {
    await supabase
      .from("integration_sync_schedules")
      .update({
        last_run_at: new Date().toISOString(),
        last_result: { success: false, error: result.error },
        next_run_at: getNextRunAt(row.cron_expression, new Date(), row.timezone).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", scheduleId);
    return { ok: false, error: result.error };
  }

  await supabase
    .from("integration_sync_schedules")
    .update({
      last_run_at: new Date().toISOString(),
      last_result: { success: true, jobId: result.jobId },
      next_run_at: getNextRunAt(row.cron_expression, new Date(), row.timezone).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", scheduleId);

  return { ok: true };
}
