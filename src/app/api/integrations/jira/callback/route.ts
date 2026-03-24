import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import { verifyJiraState } from "@/lib/jira/state";
import { env } from "@/lib/env";
import { JiraAuthService } from "@/services/jira/jiraAuthService";
import { linkJiraIntegrationAccount } from "@/modules/integrations/providers/jira/accountLink";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();
  const authService = new JiraAuthService(admin);

  const code = req.nextUrl.searchParams.get("code");
  const stateParam = req.nextUrl.searchParams.get("state");

  if (!code || !stateParam) {
    const base = new URL(req.url);
    return NextResponse.redirect(
      new URL(
        `/org/settings/integrations/jira?jira=error&msg=missing_code_or_state&orgId=${base.searchParams.get("orgId") ?? ""}`,
        base.origin
      )
    );
  }

  let state: { orgId: string; userId: string; returnTo?: string };
  try {
    state = verifyJiraState(stateParam) as { orgId: string; userId: string; returnTo?: string };
  } catch {
    const base = new URL(req.url);
    return NextResponse.redirect(
      new URL("/org/settings/integrations/jira?jira=error&msg=invalid_state", base.origin)
    );
  }

  const redirectUri =
    env.jiraRedirectUri ??
    new URL("/api/integrations/jira/callback", req.url).toString();

  let tokens: { access_token: string; refresh_token?: string; expires_in?: number };
  try {
    tokens = await authService.exchangeCodeForTokens(code, redirectUri);
  } catch (e) {
    const base = new URL(req.url);
    const msg = encodeURIComponent(
      e instanceof Error ? e.message : "oauth_failed"
    );
    return NextResponse.redirect(
      new URL(`/org/settings/integrations/jira?jira=error&msg=${msg}`, base.origin)
    );
  }

  let resources: { id: string; name: string; url?: string; scopes?: string[] }[];
  try {
    resources = await authService.getAccessibleResources(tokens.access_token);
  } catch {
    const base = new URL(req.url);
    return NextResponse.redirect(
      new URL(
        "/org/settings/integrations/jira?jira=error&msg=failed_to_fetch_resources",
        base.origin
      )
    );
  }

  if (resources.length === 0) {
    const base = new URL(req.url);
    return NextResponse.redirect(
      new URL(
        "/org/settings/integrations/jira?jira=error&msg=no_accessible_resources",
        base.origin
      )
    );
  }

  if (resources.length > 1) {
    const base = new URL(req.url);
    return NextResponse.redirect(
      new URL(
        `/org/settings/integrations/jira?jira=resource_selection_required&orgId=${state.orgId}`,
        base.origin
      )
    );
  }

  const resource = resources[0];
  try {
    await authService.persistConnection(state.orgId, tokens, resource);
    await linkJiraIntegrationAccount(admin, {
      orgId: state.orgId,
      userId: state.userId,
      cloudId: resource.id,
      siteName: resource.name,
    });
  } catch {
    const base = new URL(req.url);
    return NextResponse.redirect(
      new URL(
        "/org/settings/integrations/jira?jira=error&msg=store_failed",
        base.origin
      )
    );
  }

  const siteUrl = JiraAuthService.siteUrlFromResource(resource);
  await auditLog(supabase, {
    orgId: state.orgId,
    actorId: state.userId,
    actorType: "USER",
    action: "jira_connected",
    entityType: "integration",
    entityId: "jira",
    metadata: { cloudId: resource.id, siteName: resource.name, siteUrl },
  });

  const base = new URL(req.url);
  const redirectPath =
    state.returnTo === "setup"
      ? `/org/settings/integrations/jira/setup?orgId=${state.orgId}&step=projects&jira=connected`
      : `/org/settings/integrations/jira?orgId=${state.orgId}&jira=connected`;
  return NextResponse.redirect(new URL(redirectPath, base.origin));
}
