import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { createPrivilegedClient } from "@/lib/server/adminClient";
import { insertPurgeRequest, listPurgeRequestsForOrg } from "@/modules/org-purge/org-purge.repository";
import { evaluateOrgPurgeRetention } from "@/modules/org-purge/org-purge-retention-evaluator.service";
import { auditLog } from "@/lib/audit";

const postSchema = z.object({
  orgId: z.string().uuid(),
  reason: z.string().min(1).max(4000),
  legalHoldActive: z.boolean(),
});

export async function GET(req: NextRequest) {
  try {
    const orgIdRaw = req.nextUrl.searchParams.get("orgId");
    if (!orgIdRaw) return NextResponse.json({ error: "orgId required" }, { status: 400 });
    const orgId = parseRequestedOrgId(orgIdRaw);
    const ctx = await requireOrgPermission(orgId, "domains.manage");
    const admin = createPrivilegedClient("org-purge:list requests");
    const { data, error } = await listPurgeRequestsForOrg(admin, orgId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ requests: data });
  } catch (e) {
    return authzErrorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = postSchema.parse(await req.json());
    const ctx = await requireOrgPermission(body.orgId, "domains.manage");
    const admin = createPrivilegedClient("org-purge:create request");

    const { data: org } = await admin.from("organizations").select("id,name").eq("id", body.orgId).maybeSingle();
    if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

    const evaluation = evaluateOrgPurgeRetention({ legalHoldActive: body.legalHoldActive });
    const status = evaluation.blocked ? "blocked_legal_hold" : "pending_approval";

    const { data: row, error } = await insertPurgeRequest(admin, {
      target_org_id: body.orgId,
      target_org_name: String((org as { name?: string }).name ?? ""),
      status,
      legal_hold_active: body.legalHoldActive,
      reason: body.reason,
      retention_exception_summary: { exceptions: evaluation.blocked ? [] : evaluation.exceptions },
      requested_by_user_id: ctx.user.id,
      approved_by_user_id: null,
      scheduled_execute_at: null,
    });
    if (error || !row) return NextResponse.json({ error: error?.message ?? "insert failed" }, { status: 500 });

    await auditLog(ctx.supabase, {
      orgId: body.orgId,
      actorId: ctx.user.id,
      action: "org.purge.requested",
      entityType: "org_purge_request",
      entityId: row.id,
      metadata: { legal_hold_active: body.legalHoldActive, status: row.status },
    });

    return NextResponse.json({ request: row });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return authzErrorResponse(e);
  }
}
