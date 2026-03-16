import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type RiskBucket = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

function parseRangeDays(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("range") ?? "30d";
  const match = raw.match(/^(\d+)\s*d$/i);
  const days = match ? Number(match[1]) : 30;
  return Number.isFinite(days) && days > 0 ? Math.min(days, 365) : 30;
}

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const userId = userRes.user.id;

  const { data: membership, error: memErr } = await supabase
    .from("organization_members")
    .select("org_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (memErr) {
    return NextResponse.json({ ok: false, error: memErr.message }, { status: 500 });
  }
  if (!membership?.org_id) {
    return NextResponse.json({ ok: false, error: "no_org_membership" }, { status: 400 });
  }
  const orgId = membership.org_id;

  const rangeDays = parseRangeDays(req);
  const since = new Date();
  since.setDate(since.getDate() - (rangeDays - 1));
  since.setHours(0, 0, 0, 0);

  const { data: changes, error: changesErr } = await supabase
    .from("change_events")
    .select("id, created_at, revenue_surface, estimated_mrr_affected, domain, sla_status, due_at")
    .eq("org_id", orgId)
    .eq("domain", "REVENUE")
    .gte("created_at", since.toISOString());

  if (changesErr) {
    return NextResponse.json({ ok: false, error: changesErr.message }, { status: 500 });
  }

  const changeIds = (changes ?? []).map((c) => c.id);
  if (changeIds.length === 0) {
    return NextResponse.json({
      ok: true,
      rangeDays,
      revenueAtRisk: {
        totalEstimatedMrrAffected: 0,
        criticalChangeCount: 0,
        highChangeCount: 0,
        overdueCount: 0,
      },
      byRevenueSurface: [],
      trend: [],
      topDrivers: [],
    });
  }

  const { data: outputs, error: outputsErr } = await supabase
    .from("risk_assessment_outputs")
    .select("change_event_id, risk_bucket, exposure_score, computed_at")
    .eq("org_id", orgId)
    .in("change_event_id", changeIds)
    .order("computed_at", { ascending: false });

  if (outputsErr) {
    return NextResponse.json({ ok: false, error: outputsErr.message }, { status: 500 });
  }

  const latestByChange = new Map<
    string,
    { risk_bucket: RiskBucket; exposure_score: number; computed_at: string }
  >();
  for (const o of outputs ?? []) {
    if (!latestByChange.has(o.change_event_id)) {
      latestByChange.set(o.change_event_id, {
        risk_bucket: o.risk_bucket as RiskBucket,
        exposure_score: Number(o.exposure_score ?? 0),
        computed_at: o.computed_at,
      });
    }
  }

  let totalEstimatedMrrAffected = 0;
  let criticalChangeCount = 0;
  let highChangeCount = 0;
  let overdueCount = 0;

  const bySurface = new Map<
    string,
    { surface: string; critical: number; high: number; mrrAffected: number }
  >();

  const trend = new Map<
    string,
    { date: string; critical: number; high: number; mrrAffected: number }
  >();

  for (const c of changes ?? []) {
    const latest = latestByChange.get(c.id);
    if (!latest) continue;

    const bucket = latest.risk_bucket;
    const surface = (c.revenue_surface ?? "UNSPECIFIED") as string;

    const hasMrr = c.estimated_mrr_affected != null;
    const mrr = hasMrr ? Number(c.estimated_mrr_affected) : 0;
    if (hasMrr) totalEstimatedMrrAffected += mrr;

    if (bucket === "CRITICAL") criticalChangeCount += 1;
    if (bucket === "HIGH" || bucket === "CRITICAL") highChangeCount += 1;

    if (c.sla_status === "OVERDUE" || c.sla_status === "ESCALATED") {
      overdueCount += 1;
    } else if (c.due_at && new Date(c.due_at).getTime() < Date.now()) {
      overdueCount += 1;
    }

    if (!bySurface.has(surface)) {
      bySurface.set(surface, { surface, critical: 0, high: 0, mrrAffected: 0 });
    }
    const s = bySurface.get(surface)!;
    if (bucket === "CRITICAL") s.critical += 1;
    if (bucket === "HIGH" || bucket === "CRITICAL") s.high += 1;
    if (hasMrr) s.mrrAffected += mrr;

    const dk = isoDay(new Date(c.created_at));
    if (!trend.has(dk)) trend.set(dk, { date: dk, critical: 0, high: 0, mrrAffected: 0 });
    const t = trend.get(dk)!;
    if (bucket === "CRITICAL") t.critical += 1;
    if (bucket === "HIGH" || bucket === "CRITICAL") t.high += 1;
    if (hasMrr) t.mrrAffected += mrr;
  }

  const highRiskChangeIds = (changes ?? [])
    .filter((c) => {
      const latest = latestByChange.get(c.id);
      return latest && (latest.risk_bucket === "HIGH" || latest.risk_bucket === "CRITICAL");
    })
    .map((c) => c.id);

  let topDrivers: Array<{ signalKey: string; count: number }> = [];
  if (highRiskChangeIds.length > 0) {
    const { data: sigs, error: sigErr } = await supabase
      .from("risk_signals")
      .select("signal_key, change_event_id")
      .in("change_event_id", highRiskChangeIds);

    if (!sigErr) {
      const freq = new Map<string, number>();
      for (const s of sigs ?? []) {
        freq.set(s.signal_key, (freq.get(s.signal_key) ?? 0) + 1);
      }
      topDrivers = Array.from(freq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([signalKey, count]) => ({ signalKey, count }));
    }
  }

  return NextResponse.json({
    ok: true,
    rangeDays,
    revenueAtRisk: {
      totalEstimatedMrrAffected,
      criticalChangeCount,
      highChangeCount,
      overdueCount,
    },
    byRevenueSurface: Array.from(bySurface.values()).sort(
      (a, b) => (b.mrrAffected ?? 0) - (a.mrrAffected ?? 0)
    ),
    trend: Array.from(trend.values()).sort((a, b) => a.date.localeCompare(b.date)),
    topDrivers,
  });
}
