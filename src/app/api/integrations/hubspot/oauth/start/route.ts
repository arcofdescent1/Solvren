/**
 * @deprecated Phase 2 compatibility route. HubSpot now runs through the new runtime layer.
 * This OAuth start flow remains for the existing setup wizard; to be folded into generic
 * [provider]/connect/start when migration completes.
 */
import { NextRequest, NextResponse } from "next/server";
import { signHubSpotState } from "@/lib/hubspot/state";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { env } from "@/lib/env";

const SCOPES = "crm.objects.contacts.read crm.objects.companies.read crm.objects.deals.read crm.schemas.contacts.read crm.schemas.companies.read crm.schemas.deals.read";

export async function POST(req: NextRequest) {
  try {
    if (!env.hubspotIntegrationEnabled) return NextResponse.json({ error: "HubSpot not configured" }, { status: 503 });
    let body: { organizationId?: string };
    try {
      body = (await req.json()) as { organizationId?: string };
    } catch {
      body = {};
    }
    const orgIdRaw = body.organizationId ?? req.nextUrl.searchParams.get("orgId");
    if (!orgIdRaw) return NextResponse.json({ error: "organizationId required" }, { status: 400 });

    const ctx = await requireOrgPermission(parseRequestedOrgId(orgIdRaw), "integrations.manage");

    const clientId = env.hubspotClientId;
    if (!clientId) return NextResponse.json({ error: "hubspot_not_configured" }, { status: 500 });

    const redirectUri = env.hubspotRedirectUri ?? `${env.appUrl}/api/integrations/hubspot/oauth/callback`;
    const state = signHubSpotState({ orgId: ctx.orgId, userId: ctx.user.id });

    const url = new URL(env.hubspotOAuthAuthorizeUrl);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("state", state);

    return NextResponse.json({ authorizeUrl: url.toString() });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
