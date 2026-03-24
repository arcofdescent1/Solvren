import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authzErrorResponse, requireOrgPermission } from "@/lib/server/authz";
import { createPrivilegedClient } from "@/lib/server/adminClient";
import { getPurgeRequest, updatePurgeRequest } from "@/modules/org-purge/org-purge.repository";
import { auditLog } from "@/lib/audit";

const bodySchema = z.object({
  scheduledExecuteAt: z.string().min(1).nullable().optional(),
});

function allowSameApprover(): boolean {
  return process.env.ORG_PURGE_ALLOW_SAME_APPROVER === "true";
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const json = bodySchema.parse(await req.json().catch(() => ({})));
    const admin = createPrivilegedClient("org-purge:approve");
    const { data: reqRow, error } = await getPurgeRequest(admin, id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!reqRow) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const auth = await requireOrgPermission(reqRow.target_org_id, "domains.manage");

    if (reqRow.status === "blocked_legal_hold") {
      return NextResponse.json({ error: "Request is blocked by legal hold" }, { status: 409 });
    }
    if (reqRow.status !== "pending_approval") {
      return NextResponse.json({ error: `Cannot approve request in status ${reqRow.status}` }, { status: 409 });
    }

    if (!allowSameApprover() && reqRow.requested_by_user_id === auth.user.id) {
      return NextResponse.json({ error: "Approver must differ from requester (or set ORG_PURGE_ALLOW_SAME_APPROVER=true)" }, { status: 403 });
    }

    await updatePurgeRequest(admin, id, {
      status: "approved",
      approved_by_user_id: auth.user.id,
      scheduled_execute_at: json.scheduledExecuteAt ?? null,
    });

    await auditLog(auth.supabase, {
      orgId: reqRow.target_org_id,
      actorId: auth.user.id,
      action: "org.purge.approved",
      entityType: "org_purge_request",
      entityId: id,
      metadata: { scheduled_execute_at: json.scheduledExecuteAt ?? null },
    });

    const { data: updated } = await getPurgeRequest(admin, id);
    return NextResponse.json({ request: updated });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.message }, { status: 400 });
    return authzErrorResponse(e);
  }
}
