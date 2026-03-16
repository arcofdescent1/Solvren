/**
 * Gap 5: Metric snapshots for trend graphs.
 * GET /api/metrics/snapshots?period=24h|7d|30d
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId) {
    return NextResponse.json({ snapshots: [] });
  }

  const url = new URL(req.url);
  const period = url.searchParams.get("period") ?? "7d";
  const since = new Date();
  if (period === "24h") since.setHours(since.getHours() - 24);
  else if (period === "30d") since.setDate(since.getDate() - 30);
  else since.setDate(since.getDate() - 7);

  const { data: rows } = await supabase
    .from("metric_snapshots")
    .select("metric_name, metric_value, snapshot_time")
    .eq("organization_id", activeOrgId)
    .gte("snapshot_time", since.toISOString())
    .order("snapshot_time", { ascending: true });

  return NextResponse.json({ snapshots: rows ?? [] });
}
