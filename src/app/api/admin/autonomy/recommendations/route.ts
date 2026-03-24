/**
 * Phase 8 — GET /api/admin/autonomy/recommendations.
 */
import { NextResponse } from "next/server";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";

export async function GET() {
  try {
    const ctx = await requireAnyOrgPermission("admin.simulations.manage");

    const { data: recs, error } = await ctx.supabase
      .from("recommendations")
      .select("*")
      .eq("org_id", ctx.orgId)
      .in("status", ["open"])
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ recommendations: recs ?? [] });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
