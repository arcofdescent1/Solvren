/**
 * @deprecated Use POST /api/integrations/jira/oauth/start instead.
 * This route is retained for backwards compatibility with old links.
 * All new code should use oauth/start.
 */
import { NextRequest, NextResponse } from "next/server";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { signJiraState } from "@/lib/jira/state";
import { env } from "@/lib/env";
import { authStateFromUser, requireVerifiedResponse } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { JIRA_OAUTH_SCOPE_STRING } from "@/lib/jira/constants";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    const forbidden = requireVerifiedResponse(authStateFromUser(userRes.user));
    if (forbidden) return forbidden;

    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "missing_orgId" }, { status: 400 });

    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.manage");

    const clientId = env.jiraClientId;
    if (!clientId) {
      return NextResponse.json(
        { error: "jira_not_configured" },
        { status: 500 }
      );
    }

    const redirectUri =
      env.jiraRedirectUri ??
      new URL("/api/integrations/jira/callback", req.url).toString();

    const state = signJiraState({
      orgId: ctx.orgId,
      userId: ctx.user.id,
    });

    const url = new URL("https://auth.atlassian.com/authorize");
    url.searchParams.set("audience", "api.atlassian.com");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("scope", JIRA_OAUTH_SCOPE_STRING);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("prompt", "consent");

    const res = NextResponse.redirect(url.toString());
    res.headers.set("Deprecation", "true");
    return res;
  } catch (e) {
    return authzErrorResponse(e);
  }
}
