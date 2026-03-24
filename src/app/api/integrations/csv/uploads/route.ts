/**
 * Phase 3 — List CSV uploads for org.
 */
import { NextRequest, NextResponse } from "next/server";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";

export async function GET(req: NextRequest) {
  try {
    const orgIdRaw = req.nextUrl.searchParams.get("orgId");
    if (!orgIdRaw) return NextResponse.json({ error: "orgId required" }, { status: 400 });
    const ctx = await requireOrgPermission(parseRequestedOrgId(orgIdRaw), "integrations.view");

    const { data } = await ctx.supabase
      .from("integration_file_uploads")
      .select("id, filename, row_count, status, created_at")
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: false })
      .limit(50);

    return NextResponse.json({ ok: true, uploads: data ?? [] });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
