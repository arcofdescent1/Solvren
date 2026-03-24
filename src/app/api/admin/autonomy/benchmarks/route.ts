/**
 * Phase 8/6 — GET /api/admin/autonomy/benchmarks.
 * Uses Phase 6 benchmark_snapshots schema (cohort_id, metric_id).
 */
import { NextResponse } from "next/server";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";

export async function GET() {
  try {
    const ctx = await requireAnyOrgPermission("admin.simulations.manage");

    const { data: snapshots } = await ctx.supabase
      .from("benchmark_snapshots")
      .select(
        "id, cohort_id, metric_id, snapshot_time, org_count, metric_coverage_rate, median_value, confidence_score, confidence_band"
      )
      .order("snapshot_time", { ascending: false })
      .limit(20);

    return NextResponse.json({ benchmarks: snapshots ?? [] });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
