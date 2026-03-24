import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { IntegrationHealthService } from "@/modules/integrations";
import { testJiraConnection } from "@/modules/integrations/providers/jira/health";

export async function POST(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });
    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.view");
    const admin = createAdminClient();

    const healthSvc = new IntegrationHealthService(admin);
    const result = await testJiraConnection(ctx.orgId);
    const checks: Array<{ name: string; status: "ok" | "warning" | "error"; message?: string }> = [
      { name: "auth", status: result.success ? "ok" : "error", message: result.message },
      { name: "api_access", status: result.success ? "ok" : "error", message: result.message },
    ];
    if (!result.success) {
      await healthSvc.markError(ctx.orgId, "jira", result.message ?? "Jira connection test failed");
      return NextResponse.json({ success: false, error: result.message, checks }, { status: 502 });
    }

    await healthSvc.markHealthy(ctx.orgId, "jira");

    return NextResponse.json({
      success: true,
      status: "ok",
      checks,
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
