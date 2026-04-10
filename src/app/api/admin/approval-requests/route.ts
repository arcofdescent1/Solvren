/**
 * Phase 3 — GET /api/admin/approval-requests (list pending).
 */
import { NextRequest, NextResponse } from "next/server";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";
import { listPendingApprovals } from "@/modules/policy/repositories/approval-requests.repository";

export async function GET(_req: NextRequest) {
  try {
    const ctx = await requireAnyOrgPermission("queue.admin.view");
    const { data, error } = await listPendingApprovals(ctx.supabase, ctx.orgId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ approvalRequests: data ?? [] });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
