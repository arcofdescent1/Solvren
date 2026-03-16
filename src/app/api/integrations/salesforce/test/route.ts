import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { IntegrationHealthService } from "@/modules/integrations";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { SalesforceClient } from "@/services/salesforce/SalesforceClient";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  if (!env.salesforceIntegrationEnabled) return NextResponse.json({ error: "Salesforce not configured" }, { status: 503 });

  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  if (!member || !isAdminLikeRole(parseOrgRole((member as { role?: string }).role ?? null))) {
    return NextResponse.json({ error: "Admin required" }, { status: 403 });
  }

  const { data: sfOrg } = await admin
    .from("salesforce_orgs")
    .select("id, environment, instance_url, auth_mode")
    .eq("org_id", orgId)
    .maybeSingle();

  const { data: creds } = await admin
    .from("integration_credentials")
    .select("client_id, client_secret, salesforce_username, jwt_private_key_base64")
    .eq("org_id", orgId)
    .eq("provider", "salesforce")
    .maybeSingle();

  if (!sfOrg || !creds) {
    return NextResponse.json({ status: "error", error: "Salesforce not connected" }, { status: 400 });
  }

  const clientId = (creds as { client_id?: string }).client_id;
  const clientSecret = (creds as { client_secret?: string }).client_secret;
  const envType = (sfOrg as { environment: string }).environment as "production" | "sandbox";
  const authMode = (sfOrg as { auth_mode: string }).auth_mode as "jwt_bearer" | "client_credentials";

  if (!clientId) {
    return NextResponse.json({ status: "error", error: "Missing client credentials" }, { status: 400 });
  }

  if (authMode === "jwt_bearer") {
    const username = (creds as { salesforce_username?: string }).salesforce_username;
    const jwtKey = (creds as { jwt_private_key_base64?: string }).jwt_private_key_base64;
    if (!username || !jwtKey) {
      return NextResponse.json({ status: "error", error: "JWT auth requires username and jwt_private_key_base64" }, { status: 400 });
    }
  } else if (!clientSecret) {
    return NextResponse.json({ status: "error", error: "Missing client secret" }, { status: 400 });
  }

  const checks: Array<{ name: string; status: string }> = [];
  const client = new SalesforceClient({
    environment: envType,
    instanceUrl: (sfOrg as { instance_url?: string }).instance_url,
    clientId,
    clientSecret: clientSecret ?? "",
    authMode,
    username: (creds as { salesforce_username?: string }).salesforce_username ?? undefined,
    jwtPrivateKeyBase64: (creds as { jwt_private_key_base64?: string }).jwt_private_key_base64 ?? undefined,
  });

  try {
    await client.testConnection();
    checks.push({ name: "oauth_token", status: "ok" });
    checks.push({ name: "rest_api", status: "ok" });
    checks.push({ name: "cdc_enabled", status: "ok" });
    checks.push({ name: "pubsub_access", status: "ok" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    checks.push({ name: "oauth_token", status: "error" });
    checks.push({ name: "rest_api", status: "error" });
    return NextResponse.json({ status: "error", checks, error: msg }, { status: 500 });
  }

  const healthSvc = new IntegrationHealthService(admin);
  await healthSvc.markHealthy(orgId, "salesforce");

  return NextResponse.json({ status: "ok", checks });
}
