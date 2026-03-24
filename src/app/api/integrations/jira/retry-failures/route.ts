import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { IntegrationRetryService } from "@/modules/integrations";

export async function POST(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });
    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.manage");
    const admin = createAdminClient();

    const retrySvc = new IntegrationRetryService(admin);
    const count = await retrySvc.retryNow(ctx.orgId, "jira");

    return NextResponse.json({ ok: true, queued: count });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
