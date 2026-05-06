import { NextRequest, NextResponse } from "next/server";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { env } from "@/lib/env";
import { signOAuthState } from "@/lib/integrations/oauthState";

export async function POST(req: NextRequest) {
  try {
    if (!env.salesforceIntegrationEnabled) {
      return NextResponse.json({ error: "Salesforce not configured" }, { status: 503 });
    }
    const clientId = env.salesforceConnectedAppClientId;
    if (!clientId || !env.salesforceConnectedAppClientSecret) {
      return NextResponse.json({ error: "salesforce_connected_app_not_configured" }, { status: 503 });
    }

    let body: { organizationId?: string; environment?: "production" | "sandbox" };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      body = {};
    }
    const orgIdRaw = body.organizationId ?? req.nextUrl.searchParams.get("orgId");
    if (!orgIdRaw) return NextResponse.json({ error: "organizationId required" }, { status: 400 });

    const ctx = await requireOrgPermission(parseRequestedOrgId(orgIdRaw), "integrations.manage");
    const environment = body.environment ?? "production";

    const base = new URL(req.url).origin;
    const redirectUri =
      env.salesforceOAuthRedirectUri ?? `${base}/api/integrations/salesforce/oauth/callback`;

    const state = signOAuthState("salesforce", {
      orgId: ctx.orgId,
      userId: ctx.user.id,
      sfEnvironment: environment,
    });

    const loginUrl = environment === "sandbox" ? env.salesforceTestLoginUrl : env.salesforceLoginUrl;
    const authUrl = new URL(`${loginUrl}/services/oauth2/authorize`);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", "api refresh_token");
    authUrl.searchParams.set("state", state);

    return NextResponse.json({ authorizeUrl: authUrl.toString() });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
