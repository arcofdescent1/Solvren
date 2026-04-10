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
 * POST /api/outcomes/report/value-stories — CSV export only (ADMIN/OWNER).
 * Body: { orgId?, periodStart?: "2026-04-01", periodEnd?: "2026-04-30" }
 */
export async function POST(req: NextRequest) {
  try {
    let body: { orgId?: string; periodStart?: string; periodEnd?: string };
    try {
      body = (await req.json()) as { orgId?: string; periodStart?: string; periodEnd?: string };
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

    const ref = new Date();
    const start =
      body.periodStart ??
      new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1)).toISOString().slice(0, 10);
    const end =
      body.periodEnd ??
      new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);

    const admin = createPrivilegedClient("POST /api/outcomes/report/value-stories");
    const { data: ins, error } = await admin
      .from("generated_reports")
      .insert({
        org_id: orgId,
        report_type: "VALUE_STORY_EXPORT",
        period_start: start,
        period_end: end,
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
