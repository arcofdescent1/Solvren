/**
 * GET /api/integrations/hubspot/objects/[type]/properties
 * Get properties for a HubSpot object type (deals, contacts, etc).
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { HubSpotClient } from "@/services/hubspot/HubSpotClient";
import { refreshAccessToken, needsRefresh } from "@/services/hubspot/HubSpotAuthService";
import { env } from "@/lib/env";
import { revealCredentialTokenFields, sealCredentialTokenFields } from "@/lib/server/integrationTokenFields";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    if (!env.hubspotIntegrationEnabled) return NextResponse.json({ error: "HubSpot not configured" }, { status: 503 });

    const orgId = req.nextUrl.searchParams.get("orgId");
    const objectType = (await params).type;
    if (!orgId || !objectType) return NextResponse.json({ error: "orgId and type required" }, { status: 400 });

    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.view");
    const admin = createAdminClient();

    const { data: account } = await admin
    .from("hubspot_accounts")
    .select("auth_mode")
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  const { data: credsRaw } = await admin
    .from("integration_credentials")
    .select("access_token, refresh_token, expires_at, private_app_token")
    .eq("org_id", ctx.orgId)
    .eq("provider", "hubspot")
    .maybeSingle();

  if (!account || !credsRaw) return NextResponse.json({ error: "HubSpot not connected" }, { status: 400 });

  const creds = revealCredentialTokenFields(credsRaw as Record<string, unknown>) as {
    access_token?: string;
    refresh_token?: string;
    expires_at?: string | null;
    private_app_token?: string;
  };

  const authMode = (account as { auth_mode: string }).auth_mode;
  let accessToken: string;

  if (authMode === "private_app") {
    accessToken = creds.private_app_token ?? creds.access_token ?? "";
  } else {
    const token = creds.access_token;
    const refresh = creds.refresh_token;
    const expiresAt = creds.expires_at ?? null;
    if (!token || !refresh) return NextResponse.json({ error: "Missing OAuth credentials" }, { status: 400 });
    if (needsRefresh(expiresAt)) {
      const refreshed = await refreshAccessToken(refresh);
      accessToken = refreshed.accessToken;
      await admin
        .from("integration_credentials")
        .update(sealCredentialTokenFields({ access_token: refreshed.accessToken }))
        .eq("org_id", ctx.orgId)
        .eq("provider", "hubspot");
    } else {
      accessToken = token;
    }
  }

  const client = new HubSpotClient({ accessToken });

  try {
    const { properties } = await client.getObjectProperties(objectType);
    return NextResponse.json({ properties });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to get properties" },
      { status: 500 }
    );
  }
} catch (e) {
  return authzErrorResponse(e);
}
}
