/**
 * Phase 10 — playbook_performance_snapshots repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlaybookPerformanceSnapshot } from "../domain";
import { PlaybookHealthState } from "../domain";

export type PlaybookPerformanceSnapshotRow = {
  id: string;
  org_id: string;
  playbook_key: string;
  snapshot_window_start: string;
  snapshot_window_end: string;
  run_count: number;
  success_count: number;
  failure_count: number;
  partial_success_count: number;
  recovered_amount: number;
  avoided_amount: number;
  savings_amount: number;
  realized_loss_amount: number;
  avg_time_to_resolution_seconds: number | null;
  verification_success_rate: number | null;
  automation_rate: number | null;
  approval_rate: number | null;
  performance_score: number;
  health_state: string;
  reasons_json: unknown;
  metrics_json: unknown;
  created_at: string;
};

function rowToSnapshot(r: PlaybookPerformanceSnapshotRow): PlaybookPerformanceSnapshot {
  return {
    id: r.id,
    orgId: r.org_id,
    playbookKey: r.playbook_key,
    snapshotWindowStart: r.snapshot_window_start,
    snapshotWindowEnd: r.snapshot_window_end,
    runCount: r.run_count,
    successCount: r.success_count,
    failureCount: r.failure_count,
    partialSuccessCount: r.partial_success_count,
    recoveredAmount: r.recovered_amount,
    avoidedAmount: r.avoided_amount,
    savingsAmount: r.savings_amount,
    realizedLossAmount: r.realized_loss_amount,
    avgTimeToResolutionSeconds: r.avg_time_to_resolution_seconds ?? undefined,
    verificationSuccessRate: r.verification_success_rate ?? undefined,
    automationRate: r.automation_rate ?? undefined,
    approvalRate: r.approval_rate ?? undefined,
    performanceScore: r.performance_score,
    healthState: r.health_state as PlaybookHealthState,
    reasonsJson: Array.isArray(r.reasons_json) ? (r.reasons_json as string[]) : [],
    metricsJson: (r.metrics_json ?? {}) as Record<string, unknown>,
    createdAt: r.created_at,
  };
}

export async function getLatestPlaybookPerformance(
  supabase: SupabaseClient,
  orgId: string,
  options?: { playbookKey?: string }
): Promise<{ data: PlaybookPerformanceSnapshot[]; error: Error | null }> {
  let q = supabase
    .from("playbook_performance_snapshots")
    .select("*")
    .eq("org_id", orgId)
    .order("snapshot_window_end", { ascending: false });

  if (options?.playbookKey) {
    q = q.eq("playbook_key", options.playbookKey);
  }

  const { data, error } = await q.limit(options?.playbookKey ? 30 : 50);
  if (error) return { data: [], error: error as Error };

  const rows = (data ?? []) as PlaybookPerformanceSnapshotRow[];
  if (options?.playbookKey) {
    return { data: rows.map(rowToSnapshot), error: null };
  }
  const byPlaybook = new Map<string, PlaybookPerformanceSnapshotRow>();
  for (const r of rows) {
    if (!byPlaybook.has(r.playbook_key)) {
      byPlaybook.set(r.playbook_key, r);
    }
  }
  return {
    data: Array.from(byPlaybook.values()).map(rowToSnapshot),
    error: null,
  };
}
