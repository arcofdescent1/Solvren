/**
 * Phase 5 — GET /api/admin/decision-logs (list).
 */
import { NextRequest, NextResponse } from "next/server";
import { listDecisionLogs } from "@/modules/decision/repositories/decision-logs.repository";
import {
  authzErrorResponse,
  parseRequestedOrgId,
  requireOrgPermission,
} from "@/lib/server/authz";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId");
    const issueId = searchParams.get("issueId");
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50));

    if (!orgId) {
      return NextResponse.json({ error: "orgId required" }, { status: 400 });
    }

    const ctx = await requireOrgPermission(
      parseRequestedOrgId(orgId),
      "admin.jobs.view"
    );

    const { data, error } = await listDecisionLogs(ctx.supabase, ctx.orgId, {
      issueId: issueId ?? undefined,
      limit,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ logs: data });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
