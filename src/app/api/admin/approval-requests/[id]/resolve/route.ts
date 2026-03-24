/**
 * Phase 3 — POST /api/admin/approval-requests/[id]/resolve.
 */
import { NextRequest, NextResponse } from "next/server";
import { getApprovalRequest, resolveApprovalRequest } from "@/modules/policy/repositories/approval-requests.repository";
import { authzErrorResponse, resolveResourceInOrg } from "@/lib/server/authz";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const ctx = await resolveResourceInOrg({
      table: "approval_requests",
      resourceId: id,
      permission: "admin.jobs.view",
    });

    const { data: ar } = await getApprovalRequest(ctx.supabase, id);
    if (!ar) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (ar.status !== "pending") return NextResponse.json({ error: "Already resolved" }, { status: 400 });

    let body: { action?: "approve" | "reject" };
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const action = body.action ?? "approve";
    const status = action === "approve" ? "approved" : "rejected";

    const { data, error } = await resolveApprovalRequest(ctx.supabase, id, status, ctx.user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ approvalRequest: data });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
