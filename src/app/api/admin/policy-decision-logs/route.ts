/**
 * Phase 3 — GET /api/admin/policy-decision-logs (recent decisions).
 */
import { NextRequest, NextResponse } from "next/server";
import { listDecisionLogs } from "@/modules/policy/repositories/policy-decision-logs.repository";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAnyOrgPermission("policy.manage");

    const { searchParams } = new URL(req.url);
    const issueId = searchParams.get("issueId") ?? undefined;
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);

    const { data, error } = await listDecisionLogs(ctx.supabase, ctx.orgId, { issueId, limit });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ decisionLogs: data ?? [] });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
