/**
 * Phase 10 — Playbook performance (§14, §15).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { PlaybookHealthState } from "../domain";
import { getLatestPlaybookPerformance } from "../repositories/playbook-performance-snapshots.repository";

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function computePerformanceScore(metrics: {
  recoveredAmount?: number;
  avoidedAmount?: number;
  savingsAmount?: number;
  verificationSuccessRate?: number;
  runCount?: number;
  successCount?: number;
  failureCount?: number;
  automationRate?: number;
  avgTimeToResolutionSeconds?: number;
}): number {
  const outcomeNorm = clamp(
    Math.min(100, ((metrics.recoveredAmount ?? 0) + (metrics.avoidedAmount ?? 0) + (metrics.savingsAmount ?? 0)) / 100)
  );
  const verificationNorm = ((metrics.verificationSuccessRate ?? 0.8) * 100);
  const totalRuns = (metrics.runCount ?? 0) || 1;
  const reliabilityNorm = totalRuns > 0 ? ((metrics.successCount ?? 0) / totalRuns) * 100 : 70;
  const automationNorm = ((metrics.automationRate ?? 0.5) * 100);
  const timeNorm = metrics.avgTimeToResolutionSeconds != null
    ? clamp(100 - Math.min(100, metrics.avgTimeToResolutionSeconds / 3600))
    : 70;

  return clamp(
    0.3 * outcomeNorm +
      0.2 * verificationNorm +
      0.15 * reliabilityNorm +
      0.1 * automationNorm +
      0.1 * 70 +
      0.1 * timeNorm +
      0.05 * 80
  );
}

export function classifyHealthState(
  runCount: number,
  verificationRate: number | null,
  failureRate: number
): PlaybookHealthState {
  if (runCount < 3) return PlaybookHealthState.INSUFFICIENT_DATA;
  if (failureRate > 0.5) return PlaybookHealthState.BLOCKED;
  if ((verificationRate ?? 0) < 0.5) return PlaybookHealthState.DEGRADED;
  if (failureRate > 0.2 || (verificationRate ?? 0) < 0.8) return PlaybookHealthState.DEGRADED;
  return PlaybookHealthState.HEALTHY;
}
