/**
 * Phase 6 — GET /api/admin/benchmarks/:metricKey/:cohortKey (§20.3).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getBenchmarkMetric } from "@/modules/benchmarking/repositories/benchmark-metrics.repository";
import { getBenchmarkCohort } from "@/modules/benchmarking/repositories/benchmark-cohorts.repository";
import { getLatestSnapshot } from "@/modules/benchmarking/repositories/benchmark-snapshots.repository";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ metricKey: string; cohortKey: string }> }
) {
  const { metricKey, cohortKey } = await params;
  if (!metricKey || !cohortKey) {
    return NextResponse.json(
      { error: "metricKey and cohortKey required" },
      { status: 400 }
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: metric } = await getBenchmarkMetric(supabase, metricKey);
  const { data: cohort } = await getBenchmarkCohort(supabase, cohortKey);
  if (!metric || !cohort) {
    return NextResponse.json(
      { error: "Metric or cohort not found" },
      { status: 404 }
    );
  }

  const { data: snapshot } = await getLatestSnapshot(
    supabase,
    cohort.id,
    metric.id
  );

  return NextResponse.json({
    metricKey,
    cohortKey,
    metric: {
      displayName: metric.display_name,
      category: metric.category,
    },
    cohort: {
      displayName: cohort.display_name,
    },
    snapshot: snapshot
      ? {
          snapshotTime: snapshot.snapshot_time,
          orgCount: snapshot.org_count,
          metricCoverageRate: snapshot.metric_coverage_rate,
          medianValue: snapshot.median_value,
          p25Value: snapshot.p25_value,
          p75Value: snapshot.p75_value,
          meanValue: snapshot.mean_value,
          stddevValue: snapshot.stddev_value,
          confidenceScore: snapshot.confidence_score,
          confidenceBand: snapshot.confidence_band,
          reasons: snapshot.reasons_json,
        }
      : null,
  });
}
