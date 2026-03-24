import { NextRequest, NextResponse } from "next/server";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { getIntegrationsList } from "@/lib/integrations/list";

/**
 * GET /api/integrations/list?orgId= — Unified integration status (integrations.view).
 */
export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId?.trim()) {
      return NextResponse.json({ error: "orgId required" }, { status: 400 });
    }
    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.view");
    const list = await getIntegrationsList(ctx.supabase, ctx.orgId);
    return NextResponse.json({ ok: true, integrations: list });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
