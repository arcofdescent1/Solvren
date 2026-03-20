/**
 * Phase 8/6 — GET /api/admin/autonomy/benchmarks.
 * Uses Phase 6 benchmark_snapshots schema (cohort_id, metric_id).
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: snapshots } = await supabase
    .from("benchmark_snapshots")
    .select(
      "id, cohort_id, metric_id, snapshot_time, org_count, metric_coverage_rate, median_value, confidence_score, confidence_band"
    )
    .order("snapshot_time", { ascending: false })
    .limit(20);

  return NextResponse.json({ benchmarks: snapshots ?? [] });
}
