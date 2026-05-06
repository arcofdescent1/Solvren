/**
 * GET /api/customer/security/employee-access-audit?orgId= — employee access audit trail (RLS).
 */
import { NextRequest, NextResponse } from "next/server";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "org.settings.manage");
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from("employee_access_audit")
      .select(
        "id, org_id, employee_user_id, access_type, access_level, legal_basis, resource_type, resource_id, reason, grant_id, break_glass_event_id, created_at",
      )
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("[employee-access-audit GET]", error.message);
      return NextResponse.json({ error: "Failed to load audit" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, entries: data ?? [] });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
