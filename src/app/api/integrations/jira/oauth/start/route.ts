import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { env } from "@/lib/env";
import { authStateFromUser, requireVerifiedResponse } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { JiraAuthService } from "@/services/jira/jiraAuthService";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const forbidden = requireVerifiedResponse(authStateFromUser(userRes.user));
    if (forbidden) return forbidden;

    let body: { organizationId?: string; returnTo?: string };
    try {
      body = (await req.json()) as { organizationId?: string; returnTo?: string };
    } catch {
      body = {};
    }
    const orgId = body.organizationId ?? req.nextUrl.searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json({ error: "organizationId required" }, { status: 400 });
    }

    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.manage");

    const admin = createAdminClient();
    const authService = new JiraAuthService(admin);
    let authorizeUrl: string;
    try {
      authorizeUrl = authService.buildAuthorizeUrl(ctx.orgId, ctx.user.id, env.appUrl, {
        returnTo: body.returnTo,
      });
    } catch {
      return NextResponse.json(
        { error: "jira_not_configured" },
        { status: 500 }
      );
    }

    return NextResponse.json({ authorizeUrl });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
