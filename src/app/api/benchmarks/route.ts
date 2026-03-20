/**
 * Phase 6 — GET /api/benchmarks — list customer-visible benchmark comparisons for the org.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { listCustomerVisibleBenchmarkResults } from "@/modules/benchmarking/services/benchmark-query.service";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId =
    req.nextUrl.searchParams.get("orgId") ??
    (await getActiveOrg(supabase, userRes.user.id)).activeOrgId;
  if (!orgId) {
    return NextResponse.json({ error: "No active org" }, { status: 400 });
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cohortKey = req.nextUrl.searchParams.get("cohortKey") ?? "default";

  const { data, error } = await listCustomerVisibleBenchmarkResults(
    supabase,
    orgId,
    cohortKey
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    orgId,
    cohortKey,
    benchmarks: data,
  });
}
