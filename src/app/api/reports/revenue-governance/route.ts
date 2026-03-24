/**
 * CFO Feature — Revenue Governance Compliance Report API
 * GET /api/reports/revenue-governance
 */
import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function bucketChangeType(ct: string | null): string {
  const t = (ct ?? "").toLowerCase();
  if (t.includes("pricing")) return "Pricing Updates";
  if (t.includes("discount") || t.includes("promotion")) return "Discount Changes";
  if (t.includes("billing") || t.includes("payment") || t.includes("invoice")) return "Billing Logic";
  if (t.includes("contract") || t.includes("terms")) return "Contract Updates";
  if (t.includes("subscription") || t.includes("entitlement")) return "Subscription Changes";
  if (t.includes("revenue") || t.includes("recognition")) return "Revenue Recognition";
  return "Other";
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const days = Math.min(parseInt(req.nextUrl.searchParams.get("days") ?? "90", 10) || 90, 365);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: changes, error } = await scopeActiveChangeEvents(supabase.from("change_events").select(
      "id, change_type, structured_change_type, systems_involved, revenue_at_risk, estimated_mrr_affected, status, submitted_at, domain"
    ))
    .eq("org_id", orgId)
    .in("status", ["IN_REVIEW", "APPROVED", "REJECTED"])
    .gte("submitted_at", since.toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (changes ?? []) as Array<{
    id: string;
    change_type?: string | null;
    structured_change_type?: string | null;
    revenue_at_risk?: number | null;
    estimated_mrr_affected?: number | null;
    status: string;
    domain?: string | null;
  }>;

  const revenueChanges = rows.filter((c) => (c.domain ?? "REVENUE") === "REVENUE");
  const totalChanges = revenueChanges.length;
  const approvedChanges = revenueChanges.filter((c) => c.status === "APPROVED").length;
  const unapprovedChanges = totalChanges - approvedChanges;
  const complianceRate =
    totalChanges > 0 ? Math.round((approvedChanges / totalChanges) * 1000) / 10 : 100;

  const categoryMap = new Map<string, { count: number; impact: number }>();
  for (const c of revenueChanges) {
    const ct = c.structured_change_type ?? c.change_type ?? "Other";
    const bucket = bucketChangeType(ct);
    const impact =
      Number(c.revenue_at_risk ?? c.estimated_mrr_affected ?? 0) || 0;
    const prev = categoryMap.get(bucket) ?? { count: 0, impact: 0 };
    categoryMap.set(bucket, {
      count: prev.count + 1,
      impact: prev.impact + impact,
    });
  }

  const byCategory = Array.from(categoryMap.entries()).map(([category, v]) => ({
    category,
    count: v.count,
    revenueImpact: v.impact,
  }));

  let riskExposure = 0;
  const { data: riskRows } = await supabase
    .from("risk_events")
    .select("impact_amount")
    .eq("org_id", orgId)
    .gte("timestamp", since.toISOString())
    .is("approved_at", null);
  for (const r of riskRows ?? []) {
    const v = Number((r as { impact_amount?: number }).impact_amount);
    if (Number.isFinite(v)) riskExposure += v;
  }

  return NextResponse.json({
    totalChanges,
    approvedChanges,
    unapprovedChanges,
    complianceRate,
    riskExposure,
    byCategory,
    periodDays: days,
  });
}
