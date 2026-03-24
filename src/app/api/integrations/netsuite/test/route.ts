/**
 * POST /api/integrations/netsuite/test
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { IntegrationHealthService } from "@/modules/integrations";
import { env } from "@/lib/env";
import { testNetSuiteConnection } from "@/modules/integrations/providers/netsuite/health";

export async function POST(req: NextRequest) {
  try {
    if (!env.netsuiteIntegrationEnabled) return NextResponse.json({ error: "NetSuite not configured" }, { status: 503 });

    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });
    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.view");
    const admin = createAdminClient();
    const result = await testNetSuiteConnection(ctx.orgId);
    const checks: Array<{ name: string; status: string }> = result.success
      ? [
          { name: "oauth_token", status: "ok" },
          { name: "suiteql", status: "ok" },
          { name: "rest_web_services", status: "ok" },
        ]
      : [
          { name: "oauth_token", status: "error" },
          { name: "suiteql", status: "error" },
        ];
    if (!result.success) {
      return NextResponse.json({ status: "error", checks, error: result.message }, { status: 500 });
    }

    const healthSvc = new IntegrationHealthService(admin);
    await healthSvc.markHealthy(ctx.orgId, "netsuite");

    return NextResponse.json({ status: "ok", checks });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
