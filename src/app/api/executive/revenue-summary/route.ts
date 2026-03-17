import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getRevenueAtRisk30d } from "@/services/revenue/executiveMetrics";

function toNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership, error: memErr } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (memErr)
    return NextResponse.json({ error: memErr.message }, { status: 500 });
  if (!membership?.org_id)
    return NextResponse.json({ error: "No org" }, { status: 400 });

  const orgId = String(membership.org_id);
  const sinceIso = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: rows, error } = await supabase
    .from("change_events")
    .select(
      "id, title, status, submitted_at, due_at, sla_status, domain, estimated_mrr_affected, percent_customer_base_affected, revenue_surface"
    )
    .eq("org_id", orgId)
    .gte("submitted_at", sinceIso);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const changeIds = (rows ?? []).map((r: { id: string }) => r.id);
  const riskByChange = new Map<string, number>();

  if (changeIds.length > 0) {
    const { data: outputs } = await supabase
      .from("risk_assessment_outputs")
      .select("change_event_id, exposure_score")
      .eq("org_id", orgId)
      .in("change_event_id", changeIds)
      .order("computed_at", { ascending: false });

    for (const o of outputs ?? []) {
      const cid = String(o.change_event_id);
      if (!riskByChange.has(cid)) {
        riskByChange.set(cid, toNumber(o.exposure_score));
      }
    }
  }

  const changes = (rows ?? []).map((r: Record<string, unknown>) => {
    const mrr =
      r.estimated_mrr_affected == null
        ? null
        : toNumber(r.estimated_mrr_affected);
    const riskScore = riskByChange.get(String(r.id)) ?? 0;
    const exposure = mrr == null ? 0 : mrr * (riskScore / 100);

    return {
      id: r.id,
      title: r.title,
      status: r.status,
      submittedAt: r.submitted_at,
      dueAt: r.due_at,
      slaStatus: r.sla_status,
      riskScore,
      estimatedMrrAffected: mrr,
      percentCustomerBaseAffected:
        r.percent_customer_base_affected == null
          ? null
          : toNumber(r.percent_customer_base_affected),
      revenueSurface: r.revenue_surface ?? null,
      domain: r.domain ?? null,
      revenueAtRisk: exposure,
    };
  });

  const isPending = (c: { status?: unknown }) =>
    !["APPROVED", "REJECTED", "CLOSED", "RESOLVED"].includes(
      String(c.status ?? "")
    );
  const pending = changes.filter(isPending);

  const execMetrics = await getRevenueAtRisk30d(supabase, { orgId });
  const revenueAtRisk30d =
    execMetrics.totalRevenueAtRisk > 0
      ? execMetrics.totalRevenueAtRisk
      : pending.reduce((acc, c) => acc + (c.revenueAtRisk || 0), 0);

  const criticalPending = pending
    .filter((c) => c.riskScore >= 75)
    .sort((a, b) => (b.revenueAtRisk || 0) - (a.revenueAtRisk || 0))
    .slice(0, 10);

  const overdue = pending
    .filter((c) => String(c.slaStatus ?? "") === "OVERDUE")
    .slice(0, 10);

  const byDay: Record<string, { revenueAtRisk: number; count: number }> = {};
  for (const c of pending) {
    const d = new Date(c.submittedAt as string);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    byDay[key] = byDay[key] || { revenueAtRisk: 0, count: 0 };
    byDay[key].revenueAtRisk += c.revenueAtRisk || 0;
    byDay[key].count += 1;
  }

  const trend = Object.entries(byDay)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, v]) => ({ day, ...v }));

  const bySurface: Record<string, number> =
    Object.keys(execMetrics.bySurface).length > 0
      ? execMetrics.bySurface
      : (() => {
          const s: Record<string, number> = {};
          for (const c of pending) {
            const k = (c.revenueSurface ?? "UNSPECIFIED") as string;
            s[k] = (s[k] || 0) + (c.revenueAtRisk || 0);
          }
          return s;
        })();
  const topSurfaces = Object.entries(bySurface)
    .map(([surface, revenueAtRisk]) => ({ surface, revenueAtRisk }))
    .sort((a, b) => b.revenueAtRisk - a.revenueAtRisk)
    .slice(0, 8);

  return NextResponse.json({
    orgId,
    revenueAtRisk30d,
    criticalPending,
    overdue,
    trend,
    topSurfaces,
  });
}
