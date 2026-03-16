import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recomputeSignalStatsRevenueAware } from "@/services/risk/recomputeSignalStats";
import { rescoreRevenueChange } from "@/services/risk/rescoreChange";
import { env } from "@/lib/env";

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (env.cronSecret && secret !== env.cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId");
  if (!orgId)
    return NextResponse.json({ error: "Missing orgId" }, { status: 400 });

  const stats = await recomputeSignalStatsRevenueAware(supabase, {
    orgId,
    domain: "REVENUE",
    modelVersion: 1,
  });

  const days = Number(url.searchParams.get("days") ?? "90");
  const sinceIso = new Date(
    Date.now() - days * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: changes, error } = await supabase
    .from("change_events")
    .select(
      "id, org_id, domain, status, submitted_at"
    )
    .eq("org_id", orgId)
    .eq("domain", "REVENUE")
    .gte("submitted_at", sinceIso)
    .limit(2000);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  let rescored = 0;
  const failures: { changeId: string; error: string }[] = [];

  for (const c of changes ?? []) {
    try {
      const status = String((c as { status?: string }).status ?? "");
      if (["APPROVED", "REJECTED", "CLOSED", "RESOLVED"].includes(status))
        continue;

      await rescoreRevenueChange(supabase, {
        changeId: (c as { id: string }).id,
        orgId,
      });
      rescored += 1;
    } catch (e: unknown) {
      failures.push({
        changeId: (c as { id: string }).id,
        error: e instanceof Error ? e.message : "failed",
      });
    }
  }

  const debug = url.searchParams.get("debug") === "1";
  if (debug) {
    const { data: top } = await supabase
      .from("signal_stats")
      .select("domain, signal_key, bayes_mean, bayes_ci_low, bayes_ci_high, mitigation_lift")
      .eq("org_id", orgId)
      .order("bayes_mean", { ascending: false })
      .limit(10);
    return NextResponse.json({ ok: true, orgId, stats, rescored, failures: failures.slice(0, 50), top: top ?? [] });
  }

  return NextResponse.json({
    ok: true,
    orgId,
    stats,
    rescored,
    failures: failures.slice(0, 50),
  });
}
