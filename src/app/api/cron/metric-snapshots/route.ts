/**
 * Gap 5: Hourly metric snapshots cron.
 * POST /api/cron/metric-snapshots
 * Computes executive metrics per org and stores into metric_snapshots.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { computeExecutiveMetrics, storeMetricSnapshots } from "@/lib/metrics/executive";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = env.cronSecret;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Admin client not configured" },
      { status: 500 }
    );
  }

  const { data: orgs } = await supabase.from("organizations").select("id");
  const orgIds = (orgs ?? []).map((o) => o.id);
  const now = new Date();

  for (const orgId of orgIds) {
    try {
      const { metrics } = await computeExecutiveMetrics(supabase, orgId);
      await storeMetricSnapshots(supabase, orgId, metrics, now);
    } catch (e) {
      console.warn("metric_snapshots failed for org", orgId, e);
    }
  }

  return NextResponse.json({ ok: true, orgs: orgIds.length });
}
