/**
 * Phase 6 — GET /api/benchmarks/:metricKey (§20.1).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getBenchmarkResult } from "@/modules/benchmarking/services/benchmark-query.service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ metricKey: string }> }
) {
  const { metricKey } = await params;
  if (!metricKey) {
    return NextResponse.json({ error: "metricKey required" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(_req.url ?? "", "http://localhost");
  const orgId = searchParams.get("orgId");
  const cohortKey = searchParams.get("cohortKey") ?? "default";
  const customerValue = searchParams.get("customerValue");
  const numCustomerValue =
    customerValue != null ? parseFloat(customerValue) : null;

  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  const { data, error } = await getBenchmarkResult(
    supabase,
    orgId,
    metricKey,
    cohortKey,
    Number.isNaN(numCustomerValue!) ? null : numCustomerValue
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
