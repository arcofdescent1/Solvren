/**
 * POST /api/integrations/netsuite/test
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { IntegrationHealthService } from "@/modules/integrations";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { NetSuiteClient } from "@/services/netsuite/NetSuiteClient";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  if (!env.netsuiteIntegrationEnabled) return NextResponse.json({ error: "NetSuite not configured" }, { status: 503 });

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

  const { data: account } = await admin.from("netsuite_accounts").select("account_id").eq("org_id", orgId).maybeSingle();
  const { data: creds } = await admin.from("integration_credentials").select("client_id, client_secret").eq("org_id", orgId).eq("provider", "netsuite").maybeSingle();

  if (!account || !creds) {
    return NextResponse.json({ status: "error", error: "NetSuite not connected" }, { status: 400 });
  }

  const clientId = (creds as { client_id?: string }).client_id;
  const clientSecret = (creds as { client_secret?: string }).client_secret;
  const accountId = (account as { account_id: string }).account_id;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ status: "error", error: "Missing client credentials" }, { status: 400 });
  }

  const checks: Array<{ name: string; status: string }> = [];
  const client = new NetSuiteClient({ accountId, clientId, clientSecret });

  try {
    await client.testSuiteQL();
    checks.push({ name: "oauth_token", status: "ok" });
    checks.push({ name: "suiteql", status: "ok" });
    checks.push({ name: "rest_web_services", status: "ok" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    checks.push({ name: "oauth_token", status: "error" });
    checks.push({ name: "suiteql", status: "error" });
    return NextResponse.json({ status: "error", checks, error: msg }, { status: 500 });
  }

  const healthSvc = new IntegrationHealthService(admin);
  await healthSvc.markHealthy(orgId, "netsuite");

  return NextResponse.json({ status: "ok", checks });
}
