import { NextRequest, NextResponse } from "next/server";
import {
  authzErrorResponse,
  parseRequestedOrgId,
  requireOrgPermission,
  resolveDefaultOrgForUser,
} from "@/lib/server/authz";
import { createPrivilegedClient } from "@/lib/server/adminClient";
import { calendarQuarterBounds } from "@/lib/outcomes/reportPeriods";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * POST /api/outcomes/report/quarterly — enqueue quarterly business review export (ADMIN/OWNER).
 * Body: { orgId?, refDate?: ISO string }
 */
export async function POST(req: NextRequest) {
  try {
    let body: { orgId?: string; refDate?: string };
    try {
      body = (await req.json()) as { orgId?: string; refDate?: string };
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

    const ref = body.refDate ? new Date(body.refDate) : new Date();
    const { start, end } = calendarQuarterBounds(ref);
    const periodStart = start.toISOString().slice(0, 10);
    const periodEnd = end.toISOString().slice(0, 10);

    const admin = createPrivilegedClient("POST /api/outcomes/report/quarterly");
    const { data: ins, error } = await admin
      .from("generated_reports")
      .insert({
        org_id: orgId,
        report_type: "QUARTERLY_BUSINESS_REVIEW",
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
