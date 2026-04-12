import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminLikeRole } from "@/lib/rbac/roles";
import { isExecutiveUserForPhase1 } from "@/lib/rbac/isExecutiveUserForPhase1";
import { requirePhase4OrgContext } from "../_phase4Context";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const gate = await requirePhase4OrgContext();
  if (!gate.ok) return gate.response;
  const { supabase, orgId, userId, orgRole } = gate.ctx;

  const exec = await isExecutiveUserForPhase1(supabase, userId, orgId);
  if (!isAdminLikeRole(orgRole) && !exec) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize") ?? "20") || 20));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const admin = createAdminClient();
  const { data, error, count } = await admin
    .from("org_qbr_reports")
    .select("id, report_type, period_start, period_end, generated_at, delivered_at, storage_url, generated_report_id", {
      count: "exact",
    })
    .eq("org_id", orgId)
    .order("generated_at", { ascending: false })
    .range(from, to);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    page,
    pageSize,
    total: count ?? 0,
    items: data ?? [],
  });
}
