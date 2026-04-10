import { NextRequest, NextResponse } from "next/server";
import {
  authzErrorResponse,
  parseRequestedOrgId,
  requireOrgPermission,
  resolveDefaultOrgForUser,
} from "@/lib/server/authz";
import { createPrivilegedClient } from "@/lib/server/adminClient";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * POST /api/outcomes/report/monthly — enqueue monthly executive summary (ADMIN/OWNER).
 * Body: { orgId?, yearMonth?: "2026-04" }
 */
export async function POST(req: NextRequest) {
  try {
    let body: { orgId?: string; yearMonth?: string };
    try {
      body = (await req.json()) as { orgId?: string; yearMonth?: string };
    } catch {
      body = {};
    }
    const orgId = body.orgId
      ? parseRequestedOrgId(body.orgId)
      : (await resolveDefaultOrgForUser()).orgId;
    await requireOrgPermission(orgId, "org.settings.manage");
    const session = await createServerSupabaseClient();
    const { data: userRes } = await session.auth.getUser();
    const requestingUserId = userRes?.user?.id ?? null;

    const ref = body.yearMonth ? new Date(`${body.yearMonth}-01T12:00:00Z`) : new Date();
    const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
    const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0));
    const periodStart = start.toISOString().slice(0, 10);
    const periodEnd = end.toISOString().slice(0, 10);

    const admin = createPrivilegedClient("POST /api/outcomes/report/monthly");
    const { data: ins, error } = await admin
      .from("generated_reports")
      .insert({
        org_id: orgId,
        report_type: "MONTHLY_EXEC_SUMMARY",
        period_start: periodStart,
        period_end: periodEnd,
        status: "QUEUED",
        requesting_user_id: requestingUserId,
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      reportId: (ins as { id: string }).id,
      status: "QUEUED",
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
