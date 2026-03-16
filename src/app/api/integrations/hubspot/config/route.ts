import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { auditLog } from "@/lib/audit";
import { env } from "@/lib/env";
import { HubSpotClient } from "@/services/hubspot/HubSpotClient";

export async function GET(req: NextRequest) {
  if (!env.hubspotIntegrationEnabled) return NextResponse.json({ connected: false });
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: member } = await supabase.from("organization_members").select("role").eq("org_id", orgId).eq("user_id", userRes.user.id).maybeSingle();
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: account } = await admin.from("hubspot_accounts").select("hub_id, auth_mode").eq("org_id", orgId).maybeSingle();
  const { data: conn } = await admin.from("integration_connections").select("health_status, last_success_at").eq("org_id", orgId).eq("provider", "hubspot").maybeSingle();

  return NextResponse.json({
    connected: !!account,
    account: account ? { hubId: (account as { hub_id: number }).hub_id, authMode: (account as { auth_mode: string }).auth_mode } : null,
    features: { webhooksEnabled: env.hubspotWebhooksEnabled, validationEnabled: true, workflowActionsEnabled: false },
    health: { status: (conn as { health_status?: string })?.health_status ?? "unknown", lastSuccessAt: (conn as { last_success_at?: string })?.last_success_at ?? null, failedEventCount: 0 },
  });
}

export async function PUT(req: NextRequest) {
  if (!env.hubspotIntegrationEnabled) return NextResponse.json({ error: "HubSpot not configured" }, { status: 503 });
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { organizationId?: string; privateAppToken?: string; objects?: Array<{ objectType: string; enabled?: boolean; webhookEnabled?: boolean; validationEnabled?: boolean; sensitive?: boolean }> };
  try { body = (await req.json()) as typeof body; } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const orgId = body.organizationId ?? req.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "organizationId required" }, { status: 400 });
  const { data: member } = await supabase.from("organization_members").select("role").eq("org_id", orgId).eq("user_id", userRes.user.id).maybeSingle();
  if (!member || !isAdminLikeRole(parseOrgRole((member as { role?: string }).role ?? null))) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  if (body.objects && Array.isArray(body.objects)) {
    const { data: acc } = await admin.from("hubspot_accounts").select("id").eq("org_id", orgId).maybeSingle();
    const accId = (acc as { id?: string })?.id;
    if (accId) {
      for (const obj of body.objects) {
        await admin.from("hubspot_object_configs").upsert(
          { org_id: orgId, hubspot_account_id: accId, object_type: obj.objectType, enabled: obj.enabled ?? true, webhook_enabled: obj.webhookEnabled ?? false, validation_enabled: obj.validationEnabled ?? true, sensitive: obj.sensitive ?? false },
          { onConflict: "org_id,hubspot_account_id,object_type" }
        );
      }
    }
  }

  if (body.privateAppToken) {
    const client = new HubSpotClient({ accessToken: body.privateAppToken });
    let portalId: number;
    try {
      const info = await client.getAccountInfo();
      portalId = info.portalId;
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid token" }, { status: 400 });
    }

    await admin.from("integration_credentials").upsert(
      { org_id: orgId, provider: "hubspot", access_token: body.privateAppToken, refresh_token: null, expires_at: null, private_app_token: body.privateAppToken },
      { onConflict: "org_id,provider" }
    );

    const { data: conn } = await admin.from("integration_connections").upsert({ org_id: orgId, provider: "hubspot", status: "connected", config: { hubId: portalId, authMode: "private_app" } }, { onConflict: "org_id,provider" }).select("id").single();

    await admin.from("hubspot_accounts").upsert(
      { org_id: orgId, integration_connection_id: (conn as { id?: string })?.id ?? null, hub_id: portalId, auth_mode: "private_app", connected_by_user_id: userRes.user.id },
      { onConflict: "org_id,hub_id" }
    );

    const { data: acc } = await admin.from("hubspot_accounts").select("id").eq("org_id", orgId).eq("hub_id", portalId).single();
    const accId = (acc as { id?: string })?.id;

    if (body.objects && Array.isArray(body.objects) && accId) {
      for (const obj of body.objects) {
        await admin.from("hubspot_object_configs").upsert(
          { org_id: orgId, hubspot_account_id: accId, object_type: obj.objectType, enabled: obj.enabled ?? true, webhook_enabled: obj.webhookEnabled ?? false, validation_enabled: obj.validationEnabled ?? true, sensitive: obj.sensitive ?? false },
          { onConflict: "org_id,hubspot_account_id,object_type" }
        );
      }
    }
  }

  await auditLog(supabase, { orgId, actorId: userRes.user.id, actorType: "USER", action: "hubspot.config.updated", entityType: "integration", entityId: "hubspot", metadata: {} });
  return NextResponse.json({ success: true });
}
