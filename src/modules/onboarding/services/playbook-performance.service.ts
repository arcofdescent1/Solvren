/**
 * Phase 10 + Gap 5 — Playbook performance tracking (§9, §14).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { PlaybookHealthState } from "../domain";

export function classifyHealthState(
  runCount: number,
  verificationSuccessRate: number | null,
  failureRate: number
): string {
  if (runCount < 3) return PlaybookHealthState.INSUFFICIENT_DATA;
  if (failureRate > 0.2) return PlaybookHealthState.BLOCKED;
  if ((verificationSuccessRate ?? 0) < 0.8) return PlaybookHealthState.DEGRADED;
  return PlaybookHealthState.HEALTHY;
}

export function computePerformanceScore(params: {
  recoveredAmount: number;
  avoidedAmount: number;
  savingsAmount?: number;
  runCount: number;
  successCount: number;
  failureCount: number;
  verificationSuccessRate?: number;
  avgTimeToResolutionSeconds?: number;
}): number {
  const { recoveredAmount, avoidedAmount, savingsAmount = 0, runCount, successCount, verificationSuccessRate } = params;
  const valueScore = Math.min(100, (recoveredAmount + avoidedAmount + savingsAmount) / 100);
  const successScore = runCount > 0 ? (successCount / runCount) * 50 : 0;
  const verifyScore = (verificationSuccessRate ?? 0) * 50;
  return Math.round(valueScore + successScore + verifyScore);
}

export type RecordPlaybookExecutionInput = {
  orgId: string;
  playbookDefinitionId: string;
  success: boolean;
  recoveredValue?: number;
  avoidedLoss?: number;
  executionTimeMs?: number;
};

export async function recordPlaybookExecution(
  supabase: SupabaseClient,
  input: RecordPlaybookExecutionInput
): Promise<{ error: Error | null }> {
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("playbook_performance")
    .select("executions, successes, failures, total_recovered_value, total_avoided_loss, avg_execution_time_ms")
    .eq("org_id", input.orgId)
    .eq("playbook_definition_id", input.playbookDefinitionId)
    .maybeSingle();

  const row = existing as {
    executions: number;
    successes: number;
    failures: number;
    total_recovered_value: number;
    total_avoided_loss: number;
    avg_execution_time_ms: number | null;
  } | null;

  const executions = (row?.executions ?? 0) + 1;
  const successes = (row?.successes ?? 0) + (input.success ? 1 : 0);
  const failures = (row?.failures ?? 0) + (input.success ? 0 : 1);
  const totalRecovered = (Number(row?.total_recovered_value) ?? 0) + (input.recoveredValue ?? 0);
  const totalAvoided = (Number(row?.total_avoided_loss) ?? 0) + (input.avoidedLoss ?? 0);

  let avgTimeMs: number | null = null;
  if (input.executionTimeMs != null) {
    const prevAvg = row?.avg_execution_time_ms;
    const prevCount = row?.executions ?? 0;
    avgTimeMs = prevAvg != null
      ? (prevAvg * prevCount + input.executionTimeMs) / executions
      : input.executionTimeMs;
  } else if (row?.avg_execution_time_ms != null) {
    avgTimeMs = row.avg_execution_time_ms;
  }

  const successRate = executions > 0 ? successes / executions : null;

  const { error } = await supabase.from("playbook_performance").upsert(
    {
      org_id: input.orgId,
      playbook_definition_id: input.playbookDefinitionId,
      executions,
      successes,
      failures,
      total_recovered_value: totalRecovered,
      total_avoided_loss: totalAvoided,
      avg_execution_time_ms: avgTimeMs,
      success_rate: successRate,
      last_executed_at: now,
      updated_at: now,
    },
    { onConflict: "org_id,playbook_definition_id" }
  );

  return { error: error as Error | null };
}
