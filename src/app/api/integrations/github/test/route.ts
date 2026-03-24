/**
 * POST /api/integrations/github/test
 * Test GitHub connection: verify installation and repo access.
 */
import { NextRequest, NextResponse } from "next/server";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { env } from "@/lib/env";
import { testGitHubConnection } from "@/modules/integrations/providers/github/health";

export async function POST(req: NextRequest) {
  try {
    if (!env.githubEnabled) {
      return NextResponse.json({ error: "GitHub integration not configured" }, { status: 503 });
    }

    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });
    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.view");
    const result = await testGitHubConnection(ctx.orgId);
    if (!result.success) {
      return NextResponse.json({ error: result.message ?? "GitHub test failed" }, { status: 502 });
    }

    return NextResponse.json({
      status: "ok",
      installationLogin: result.details?.accountLogin ?? "unknown",
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
