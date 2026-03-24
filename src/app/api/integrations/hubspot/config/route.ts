/**
 * @deprecated Phase 2 compatibility route. HubSpot runs through the new runtime layer.
 * Private app token and object config; to be folded into generic provider config when migration completes.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { auditLog } from "@/lib/audit";
import { env } from "@/lib/env";
import { HubSpotClient } from "@/services/hubspot/HubSpotClient";
import { sealCredentialTokenFields } from "@/lib/server/integrationTokenFields";

export async function GET(req: NextRequest) {
  try {
    if (!env.hubspotIntegrationEnabled) return NextResponse.json({ connected: false });
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });
    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.view");
    const admin = createAdminClient();

    const { data: account } = await admin.from("hubspot_accounts").select("hub_id, auth_mode").eq("org_id", ctx.orgId).maybeSingle();
    const { data: conn } = await admin.from("integration_connections").select("health_status, last_success_at").eq("org_id", ctx.orgId).eq("provider", "hubspot").maybeSingle();

    return NextResponse.json({
    connected: !!account,
    account: account ? { hubId: (account as { hub_id: number }).hub_id, authMode: (account as { auth_mode: string }).auth_mode } : null,
    features: { webhooksEnabled: env.hubspotWebhooksEnabled, validationEnabled: true, workflowActionsEnabled: false },
    health: { status: (conn as { health_status?: string })?.health_status ?? "unknown", lastSuccessAt: (conn as { last_success_at?: string })?.last_success_at ?? null, failedEventCount: 0 },
  });
  } catch (e) {
    return authzErrorResponse(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!env.hubspotIntegrationEnabled) return NextResponse.json({ error: "HubSpot not configured" }, { status: 503 });
    let body: { organizationId?: string; privateAppToken?: string; objects?: Array<{ objectType: string; enabled?: boolean; webhookEnabled?: boolean; validationEnabled?: boolean; sensitive?: boolean }> };
    try { body = (await req.json()) as typeof body; } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
    const orgIdRaw = body.organizationId ?? req.nextUrl.searchParams.get("orgId");
    if (!orgIdRaw) return NextResponse.json({ error: "organizationId required" }, { status: 400 });
    const ctx = await requireOrgPermission(parseRequestedOrgId(orgIdRaw), "integrations.manage");
    const admin = createAdminClient();

    if (body.objects && Array.isArray(body.objects)) {
    const { data: acc } = await admin.from("hubspot_accounts").select("id").eq("org_id", ctx.orgId).maybeSingle();
    const accId = (acc as { id?: string })?.id;
    if (accId) {
      for (const obj of body.objects) {
        await admin.from("hubspot_object_configs").upsert(
          { org_id: ctx.orgId, hubspot_account_id: accId, object_type: obj.objectType, enabled: obj.enabled ?? true, webhook_enabled: obj.webhookEnabled ?? false, validation_enabled: obj.validationEnabled ?? true, sensitive: obj.sensitive ?? false },
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
      sealCredentialTokenFields({
        org_id: ctx.orgId,
        provider: "hubspot",
        access_token: body.privateAppToken,
        refresh_token: null,
        expires_at: null,
        private_app_token: body.privateAppToken,
      }),
      { onConflict: "org_id,provider" }
    );

    const { data: conn } = await admin.from("integration_connections").upsert({ org_id: ctx.orgId, provider: "hubspot", status: "connected", config: { hubId: portalId, authMode: "private_app" } }, { onConflict: "org_id,provider" }).select("id").single();

    await admin.from("hubspot_accounts").upsert(
      { org_id: ctx.orgId, integration_connection_id: (conn as { id?: string })?.id ?? null, hub_id: portalId, auth_mode: "private_app", connected_by_user_id: ctx.user.id },
      { onConflict: "org_id,hub_id" }
    );

    const { data: acc } = await admin.from("hubspot_accounts").select("id").eq("org_id", ctx.orgId).eq("hub_id", portalId).single();
    const accId = (acc as { id?: string })?.id;

    if (body.objects && Array.isArray(body.objects) && accId) {
      for (const obj of body.objects) {
        await admin.from("hubspot_object_configs").upsert(
          { org_id: ctx.orgId, hubspot_account_id: accId, object_type: obj.objectType, enabled: obj.enabled ?? true, webhook_enabled: obj.webhookEnabled ?? false, validation_enabled: obj.validationEnabled ?? true, sensitive: obj.sensitive ?? false },
          { onConflict: "org_id,hubspot_account_id,object_type" }
        );
      }
    }
  }

    await auditLog(ctx.supabase, { orgId: ctx.orgId, actorId: ctx.user.id, actorType: "USER", action: "hubspot.config.updated", entityType: "integration", entityId: "hubspot", metadata: {} });
    return NextResponse.json({ success: true });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
