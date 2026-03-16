import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { IntegrationHealthService } from "@/modules/integrations";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { HubSpotClient } from "@/services/hubspot/HubSpotClient";
import { refreshAccessToken, needsRefresh } from "@/services/hubspot/HubSpotAuthService";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  if (!env.hubspotIntegrationEnabled) return NextResponse.json({ error: "HubSpot not configured" }, { status: 503 });
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: member } = await supabase.from("organization_members").select("role").eq("org_id", orgId).eq("user_id", userRes.user.id).maybeSingle();
  if (!member || !isAdminLikeRole(parseOrgRole((member as { role?: string }).role ?? null))) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const { data: account } = await admin.from("hubspot_accounts").select("id, hub_id, auth_mode").eq("org_id", orgId).maybeSingle();
  const { data: creds } = await admin.from("integration_credentials").select("access_token, refresh_token, expires_at, private_app_token").eq("org_id", orgId).eq("provider", "hubspot").maybeSingle();

  if (!account || !creds) return NextResponse.json({ status: "error", error: "HubSpot not connected" }, { status: 400 });

  const authMode = (account as { auth_mode: string }).auth_mode;
  let accessToken: string;

  if (authMode === "private_app") {
    accessToken = (creds as { private_app_token?: string }).private_app_token ?? (creds as { access_token?: string }).access_token ?? "";
  } else {
    const token = (creds as { access_token?: string }).access_token;
    const refresh = (creds as { refresh_token?: string }).refresh_token;
    const expiresAt = (creds as { expires_at?: string })?.expires_at ?? null;
    if (!token || !refresh) return NextResponse.json({ status: "error", error: "Missing OAuth credentials" }, { status: 400 });
    if (needsRefresh(expiresAt)) {
      const refreshed = await refreshAccessToken(refresh);
      accessToken = refreshed.accessToken;
      await admin.from("integration_credentials").update({ access_token: refreshed.accessToken }).eq("org_id", orgId).eq("provider", "hubspot");
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
  await healthSvc.markHealthy(orgId, "hubspot");
  return NextResponse.json({ status: "ok", checks });
}
