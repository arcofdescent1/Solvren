/**
 * Phase 6 — GET /api/org/metrics — tenant usage, pipeline backlog, value rollup (observability + UI).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";

const BACKPRESSURE_PENDING_THRESHOLD = 50;

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

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceIso = since.toISOString();

  const [
    signalsRes,
    openIssuesRes,
    criticalRes,
    pendingJobsRes,
    runningJobsRes,
    valueRes,
  ] = await Promise.all([
    supabase
      .from("normalized_signals")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .gte("signal_time", sinceIso),
    supabase
      .from("issues")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "open"),
    supabase
      .from("issues")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "open")
      .eq("severity", "critical"),
    supabase
      .from("processing_jobs")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "pending"),
    supabase
      .from("processing_jobs")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "running"),
    supabase
      .from("value_events")
      .select("value_type, amount")
      .eq("org_id", orgId)
      .gte("created_at", sinceIso),
  ]);

  const valueRows = (valueRes.data ?? []) as Array<{ value_type: string; amount: number }>;
  const totalRecovered = valueRows
    .filter((r) => r.value_type === "recovered")
    .reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalAvoided = valueRows
    .filter((r) => r.value_type === "avoided")
    .reduce((s, r) => s + Number(r.amount || 0), 0);

  const pendingJobs =
    pendingJobsRes.error != null ? 0 : pendingJobsRes.count ?? 0;
  const runningJobs =
    runningJobsRes.error != null ? 0 : runningJobsRes.count ?? 0;
  const pipelineAvailable =
    pendingJobsRes.error == null && runningJobsRes.error == null;
  const ingestionThrottled = pipelineAvailable && pendingJobs >= BACKPRESSURE_PENDING_THRESHOLD;

  return NextResponse.json({
    ok: true,
    orgId,
    rangeDays: 30,
    tenantUsage: {
      signalsIngested30d: signalsRes.count ?? 0,
      openIssues: openIssuesRes.count ?? 0,
      openCriticalIssues: criticalRes.count ?? 0,
    },
    pipeline: {
      jobsPending: pendingJobs,
      jobsRunning: runningJobs,
      pipelineTableAvailable: pipelineAvailable,
      ingestionThrottled,
      backpressureThreshold: BACKPRESSURE_PENDING_THRESHOLD,
    },
    value: {
      totalRecovered30d: totalRecovered,
      totalAvoided30d: totalAvoided,
      totalValue30d: totalRecovered + totalAvoided,
    },
  });
}
