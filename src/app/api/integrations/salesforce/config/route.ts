import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { auditLog } from "@/lib/audit";
import { env } from "@/lib/env";

export async function GET(req: NextRequest) {
  if (!env.salesforceIntegrationEnabled) return NextResponse.json({ connected: false });
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

  const { data: sfOrg } = await admin
    .from("salesforce_orgs")
    .select("sf_org_id, instance_url, environment, cdc_enabled, pubsub_enabled")
    .eq("org_id", orgId)
    .maybeSingle();

  const { data: conn } = await admin
    .from("integration_connections")
    .select("health_status, last_success_at")
    .eq("org_id", orgId)
    .eq("provider", "salesforce")
    .maybeSingle();

  return NextResponse.json({
    connected: !!sfOrg,
    org: sfOrg
      ? {
          sfOrgId: (sfOrg as { sf_org_id: string }).sf_org_id,
          instanceUrl: (sfOrg as { instance_url: string }).instance_url,
          environment: (sfOrg as { environment: string }).environment,
        }
      : null,
    features: {
      cdcEnabled: (sfOrg as { cdc_enabled?: boolean })?.cdc_enabled ?? false,
      pubsubEnabled: (sfOrg as { pubsub_enabled?: boolean })?.pubsub_enabled ?? false,
      validationEnabled: true,
    },
    health: {
      status: (conn as { health_status?: string })?.health_status ?? "unknown",
      lastSuccessAt: (conn as { last_success_at?: string })?.last_success_at ?? null,
      failedEventCount: 0,
    },
  });
}

export async function PUT(req: NextRequest) {
  if (!env.salesforceIntegrationEnabled) return NextResponse.json({ error: "Salesforce not configured" }, { status: 503 });
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: {
    organizationId?: string;
    environment?: "production" | "sandbox";
    authMode?: "jwt_bearer" | "client_credentials";
    clientId?: string;
    clientSecret?: string;
    username?: string;
    jwtPrivateKeyBase64?: string;
    objects?: Array<{ objectApiName: string; enabled?: boolean; cdcEnabled?: boolean; validationEnabled?: boolean; sensitive?: boolean }>;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const orgId = body.organizationId ?? req.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "organizationId required" }, { status: 400 });
  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  if (!member || !isAdminLikeRole(parseOrgRole((member as { role?: string }).role ?? null))) {
    return NextResponse.json({ error: "Admin required" }, { status: 403 });
  }

  const environment = (body.environment ?? "production") as "production" | "sandbox";
  const authMode = body.authMode ?? "client_credentials";

  if (body.objects && Array.isArray(body.objects)) {
    const { data: sfOrgRow } = await admin.from("salesforce_orgs").select("id").eq("org_id", orgId).maybeSingle();
    const sfOrgIdUuid = (sfOrgRow as { id?: string } | null)?.id;
    if (sfOrgIdUuid) {
      for (const obj of body.objects) {
        await admin
          .from("salesforce_object_configs")
          .upsert(
            {
              org_id: orgId,
              salesforce_org_id: sfOrgIdUuid,
              object_api_name: obj.objectApiName,
              enabled: obj.enabled ?? true,
              cdc_enabled: obj.cdcEnabled ?? false,
              validation_enabled: obj.validationEnabled ?? true,
              sensitive: obj.sensitive ?? false,
            },
            { onConflict: "org_id,salesforce_org_id,object_api_name" }
          );
      }
    }
  }

  if (body.clientId && (body.clientSecret || (authMode === "jwt_bearer" && body.jwtPrivateKeyBase64 && body.username))) {
    const { getAccessTokenClientCredentials, getAccessTokenJwt } = await import("@/services/salesforce/SalesforceAuthService");
    let sfOrgId: string;
    let instanceUrl: string;
    let loginUrl: string;

    if (authMode === "jwt_bearer" && body.username && body.jwtPrivateKeyBase64) {
      const t = await getAccessTokenJwt(environment, body.clientId, body.username, body.jwtPrivateKeyBase64);
      instanceUrl = t.instanceUrl;
      const parts = t.idUrl ? t.idUrl.split("/").filter(Boolean) : [];
      sfOrgId = parts.length >= 2 ? parts[parts.length - 2] : "unknown";
      loginUrl = environment === "sandbox" ? "https://test.salesforce.com" : "https://login.salesforce.com";
    } else if (body.clientSecret) {
      const t = await getAccessTokenClientCredentials(environment, body.clientId, body.clientSecret);
      instanceUrl = t.instanceUrl;
      const parts = t.idUrl ? t.idUrl.split("/").filter(Boolean) : [];
      sfOrgId = parts.length >= 2 ? parts[parts.length - 2] : "unknown";
      loginUrl = environment === "sandbox" ? "https://test.salesforce.com" : "https://login.salesforce.com";
    } else {
      return NextResponse.json({ error: "clientSecret required for client_credentials" }, { status: 400 });
    }

    const { data: conn } = await admin
      .from("integration_connections")
      .upsert(
        {
          org_id: orgId,
          provider: "salesforce",
          status: "connected",
          config: { sfOrgId, instanceUrl, environment, authMode },
        },
        { onConflict: "org_id,provider" }
      )
      .select("id")
      .single();

    const connId = (conn as { id?: string })?.id;
    await admin.from("salesforce_orgs").upsert(
      {
        org_id: orgId,
        integration_connection_id: connId,
        sf_org_id: sfOrgId,
        instance_url: instanceUrl,
        login_url: loginUrl,
        environment,
        auth_mode: authMode,
        cdc_enabled: false,
        pubsub_enabled: false,
      },
      { onConflict: "org_id,sf_org_id" }
    );

    await admin.from("integration_credentials").upsert(
      {
        org_id: orgId,
        provider: "salesforce",
        client_id: body.clientId,
        client_secret: body.clientSecret ?? null,
        salesforce_username: body.username ?? null,
        jwt_private_key_base64: body.jwtPrivateKeyBase64 ?? null,
      },
      { onConflict: "org_id,provider" }
    );

    const sfOrgRow = await admin.from("salesforce_orgs").select("id").eq("org_id", orgId).eq("sf_org_id", sfOrgId).single();
    const sfOrgIdUuid = (sfOrgRow.data as { id?: string })?.id;

    if (body.objects && Array.isArray(body.objects) && sfOrgIdUuid) {
      for (const obj of body.objects) {
        await admin
          .from("salesforce_object_configs")
          .upsert(
            {
              org_id: orgId,
              salesforce_org_id: sfOrgIdUuid,
              object_api_name: obj.objectApiName,
              enabled: obj.enabled ?? true,
              cdc_enabled: obj.cdcEnabled ?? false,
              validation_enabled: obj.validationEnabled ?? true,
              sensitive: obj.sensitive ?? false,
            },
            { onConflict: "org_id,salesforce_org_id,object_api_name" }
          );
      }
    }
  }

  await auditLog(supabase, {
    orgId,
    actorId: userRes.user.id,
    actorType: "USER",
    action: "salesforce.config.updated",
    entityType: "integration",
    entityId: "salesforce",
    metadata: {},
  });
  return NextResponse.json({ success: true });
}
