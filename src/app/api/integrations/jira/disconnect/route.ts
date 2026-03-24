import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { auditLog } from "@/lib/audit";
import { IntegrationConnectionService } from "@/modules/integrations";

export async function POST(req: NextRequest) {
  try {
    let body: { organizationId?: string };
    try {
      body = (await req.json()) as { organizationId?: string };
    } catch {
      body = {};
    }
    const orgId = body.organizationId ?? req.nextUrl.searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "organizationId required" }, { status: 400 });

    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.manage");
    const admin = createAdminClient();

    const connSvc = new IntegrationConnectionService(admin);
    await connSvc.disconnectProvider(ctx.orgId, "jira");

    await auditLog(ctx.supabase, {
      orgId: ctx.orgId,
      actorId: ctx.user.id,
      actorType: "USER",
      action: "jira_disconnected",
      entityType: "integration",
      entityId: "jira",
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
