/**
 * Phase 6 — Build benchmark snapshots job (§17).
 * Run daily. Computes snapshots for each cohort × metric.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { listBenchmarkCohorts } from "../repositories/benchmark-cohorts.repository";
import { listBenchmarkMetrics } from "../repositories/benchmark-metrics.repository";
import { buildBenchmarkSnapshot } from "../services/benchmark-snapshot-builder.service";

export async function runBuildBenchmarkSnapshots(): Promise<{
  success: number;
  failed: number;
  errors: string[];
}> {
  const admin = createAdminClient();
  const snapshotTime = new Date();
  const errors: string[] = [];
  let success = 0;
  let failed = 0;

  const { data: cohorts } = await listBenchmarkCohorts(admin);
  const { data: metrics } = await listBenchmarkMetrics(admin);

  for (const cohort of cohorts ?? []) {
    for (const metric of metrics ?? []) {
      const result = await buildBenchmarkSnapshot(
        admin,
        cohort.cohort_key,
        metric.metric_key,
        snapshotTime
      );
      if (result.success) {
        success++;
      } else {
        failed++;
        errors.push(`${cohort.cohort_key}/${metric.metric_key}: ${result.error ?? "unknown"}`);
      }
    }
  }

  return { success, failed, errors };
}
