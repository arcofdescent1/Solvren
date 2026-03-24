import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { IntegrationHealthService } from "@/modules/integrations";
import { testSlackConnection } from "@/modules/integrations/providers/slack/health";

export async function POST(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });
    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.view");
    const admin = createAdminClient();

    const healthSvc = new IntegrationHealthService(admin);
    const result = await testSlackConnection(ctx.orgId);

    if (!result.success) {
      await healthSvc.markError(ctx.orgId, "slack", result.message ?? "Slack connection test failed");
      return NextResponse.json({ error: result.message }, { status: 502 });
    }

    await healthSvc.markHealthy(ctx.orgId, "slack");

    return NextResponse.json({
      status: "ok",
      teamName: (result.details?.teamName as string | undefined) ?? null,
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
