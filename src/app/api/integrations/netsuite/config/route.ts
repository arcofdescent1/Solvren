import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { auditLog } from "@/lib/audit";
import { env } from "@/lib/env";

export async function GET(req: NextRequest) {
  if (!env.netsuiteIntegrationEnabled) return NextResponse.json({ connected: false });
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
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: account } = await admin
    .from("netsuite_accounts")
    .select("account_id, account_name, environment")
    .eq("org_id", orgId)
    .maybeSingle();

  const { data: conn } = await admin
    .from("integration_connections")
    .select("health_status, last_success_at")
    .eq("org_id", orgId)
    .eq("provider", "netsuite")
    .maybeSingle();

  return NextResponse.json({
    connected: !!account,
    account: account ? { accountId: (account as { account_id: string }).account_id, accountName: (account as { account_name?: string }).account_name, environment: (account as { environment: string }).environment } : null,
    health: { status: (conn as { health_status?: string })?.health_status ?? "unknown", lastSuccessAt: (conn as { last_success_at?: string })?.last_success_at ?? null },
  });
}

export async function PUT(req: NextRequest) {
  if (!env.netsuiteIntegrationEnabled) return NextResponse.json({ error: "NetSuite not configured" }, { status: 503 });
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { organizationId?: string; accountId?: string; environment?: string; clientId?: string; clientSecret?: string };
  try { body = (await req.json()) as typeof body; } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const orgId = body.organizationId ?? req.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "organizationId required" }, { status: 400 });
  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  if (!member || !isAdminLikeRole(parseOrgRole((member as { role?: string }).role ?? null))) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  if (body.accountId) {
    const { data: conn } = await admin
      .from("integration_connections")
      .upsert({ org_id: orgId, provider: "netsuite", status: "connected", config: { accountId: body.accountId, environment: body.environment ?? "sandbox" } }, { onConflict: "org_id,provider" })
      .select("id")
      .single();
    const connId = (conn as { id: string })?.id;
    await admin.from("netsuite_accounts").upsert(
      { org_id: orgId, integration_connection_id: connId, account_id: body.accountId, environment: body.environment ?? "sandbox", rest_web_services_enabled: true, oauth_config_valid: true },
      { onConflict: "org_id,account_id" }
    );
    if (body.clientId && body.clientSecret) {
      await admin.from("integration_credentials").upsert(
        { org_id: orgId, provider: "netsuite", client_id: body.clientId, client_secret: body.clientSecret },
        { onConflict: "org_id,provider" }
      );
    }
  }

  await auditLog(supabase, { orgId, actorId: userRes.user.id, actorType: "USER", action: "netsuite.config.updated", entityType: "integration", entityId: "netsuite", metadata: {} });
  return NextResponse.json({ success: true });
}
