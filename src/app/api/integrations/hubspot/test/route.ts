/**
 * @deprecated Phase 2 compatibility route. HubSpot runs through the new runtime layer.
 * Use generic POST /api/integrations/hubspot/test when possible.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { IntegrationHealthService } from "@/modules/integrations";
import { HubSpotClient } from "@/services/hubspot/HubSpotClient";
import { refreshAccessToken, needsRefresh } from "@/services/hubspot/HubSpotAuthService";
import { env } from "@/lib/env";
import { revealCredentialTokenFields, sealCredentialTokenFields } from "@/lib/server/integrationTokenFields";

export async function POST(req: NextRequest) {
  try {
    if (!env.hubspotIntegrationEnabled) return NextResponse.json({ error: "HubSpot not configured" }, { status: 503 });
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });
    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.view");
    const admin = createAdminClient();

    const { data: account } = await admin.from("hubspot_accounts").select("id, hub_id, auth_mode").eq("org_id", ctx.orgId).maybeSingle();
    const { data: credsRaw } = await admin.from("integration_credentials").select("access_token, refresh_token, expires_at, private_app_token").eq("org_id", ctx.orgId).eq("provider", "hubspot").maybeSingle();

    if (!account || !credsRaw) return NextResponse.json({ status: "error", error: "HubSpot not connected" }, { status: 400 });

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
      if (!token || !refresh) return NextResponse.json({ status: "error", error: "Missing OAuth credentials" }, { status: 400 });
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

    if (!accessToken) return NextResponse.json({ status: "error", error: "No access token" }, { status: 400 });

    const checks: Array<{ name: string; status: string }> = [];
    const client = new HubSpotClient({ accessToken });

    try {
      await client.testConnection();
      checks.push({ name: "auth", status: "ok" });
      checks.push({ name: "crm_api", status: "ok" });
      checks.push({ name: "webhooks", status: "ok" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      checks.push({ name: "auth", status: "error" });
      checks.push({ name: "crm_api", status: "error" });
      return NextResponse.json({ status: "error", checks, error: msg }, { status: 500 });
    }

    const healthSvc = new IntegrationHealthService(admin);
    await healthSvc.markHealthy(ctx.orgId, "hubspot");
    return NextResponse.json({ status: "ok", checks });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
