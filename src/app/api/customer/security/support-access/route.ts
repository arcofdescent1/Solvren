/**
 * GET /api/customer/security/support-access?orgId= — list grants for org (RLS).
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

    const { data: grants, error: gErr } = await supabase
      .from("customer_access_grants")
      .select(
        "id, org_id, employee_user_id, access_level, reason, status, starts_at, expires_at, created_at, approved_at, revoked_at, denied_at, duration_hours",
      )
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: false });

    if (gErr) {
      console.error("[support-access GET]", gErr.message);
      return NextResponse.json({ error: "Failed to load grants" }, { status: 500 });
    }

    const { data: breakGlass, error: bErr } = await supabase
      .from("break_glass_access_events")
      .select(
        "id, org_id, severity, reason, duration_minutes, started_at, activated_at, expires_at, ended_at, created_at",
      )
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (bErr) {
      console.error("[support-access GET break_glass]", bErr.message);
    }

    return NextResponse.json({
      ok: true,
      grants: grants ?? [],
      breakGlassEvents: breakGlass ?? [],
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
