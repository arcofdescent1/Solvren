/**
 * Phase 1 — GET /api/integrations/schema/:provider/:object (§10).
 * Returns provider schema (source paths) for mapping UI.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { formatProviderSchema } from "@/lib/integrations/mapping/providerSchemaService";
import { hasProvider } from "@/modules/integrations/registry/providerRegistry";
import { env } from "@/lib/env";
import { revealCredentialTokenFields, sealCredentialTokenFields } from "@/lib/server/integrationTokenFields";
import { HubSpotClient } from "@/services/hubspot/HubSpotClient";
import { refreshAccessToken, needsRefresh } from "@/services/hubspot/HubSpotAuthService";
import { SalesforceClient } from "@/services/salesforce/SalesforceClient";
import {
  discoverPostgresSchema,
  discoverMysqlSchema,
  discoverSnowflakeSchema,
  discoverBigQuerySchema,
  getCsvSchema,
} from "@/services/integrations/schemaDiscovery";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string; object: string }> }
) {
  try {
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId?.trim()) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.view");
    const { provider, object: objectType } = await params;

    if (!hasProvider(provider)) {
      return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
    }

    const admin = createAdminClient();

    if (provider === "hubspot") {
      if (!env.hubspotIntegrationEnabled) return NextResponse.json({ error: "HubSpot not configured" }, { status: 503 });

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
      const { properties } = await client.getObjectProperties(objectType);
      const schema = formatProviderSchema(provider, properties);
      return NextResponse.json({ ok: true, ...schema });
    }

    if (provider === "salesforce") {
      if (!env.salesforceIntegrationEnabled) return NextResponse.json({ error: "Salesforce not configured" }, { status: 503 });

      const { data: sfOrg } = await admin
        .from("salesforce_orgs")
        .select("environment, instance_url, auth_mode")
        .eq("org_id", ctx.orgId)
        .maybeSingle();

      const { data: credsRaw } = await admin
        .from("integration_credentials")
        .select("client_id, client_secret, salesforce_username, jwt_private_key_base64")
        .eq("org_id", ctx.orgId)
        .eq("provider", "salesforce")
        .maybeSingle();

      if (!sfOrg || !credsRaw) return NextResponse.json({ error: "Salesforce not connected" }, { status: 400 });

      const creds = revealCredentialTokenFields(credsRaw as Record<string, unknown>) as {
        client_id: string;
        client_secret?: string;
        salesforce_username?: string;
        jwt_private_key_base64?: string;
      };

      const client = new SalesforceClient({
        environment: (sfOrg as { environment: string }).environment as "production" | "sandbox",
        instanceUrl: (sfOrg as { instance_url: string }).instance_url,
        clientId: creds.client_id,
        clientSecret: creds.client_secret ?? "",
        authMode: (sfOrg as { auth_mode: string }).auth_mode as "jwt_bearer" | "client_credentials",
        username: creds.salesforce_username ?? undefined,
        jwtPrivateKeyBase64: creds.jwt_private_key_base64 ?? undefined,
      });

      const { fields } = await client.describeSobject(objectType);
      const schema = formatProviderSchema(provider, fields);
      return NextResponse.json({ ok: true, ...schema });
    }

    if (provider === "stripe") {
      const stripeObjectTypes: Record<string, Array<{ name: string; type: string }>> = {
        customer: [
          { name: "id", type: "string" },
          { name: "email", type: "string" },
          { name: "name", type: "string" },
        ],
        charge: [
          { name: "id", type: "string" },
          { name: "amount", type: "number" },
          { name: "currency", type: "string" },
          { name: "created", type: "number" },
        ],
        payment_intent: [
          { name: "id", type: "string" },
          { name: "amount", type: "number" },
          { name: "currency", type: "string" },
          { name: "created", type: "number" },
        ],
        invoice: [
          { name: "id", type: "string" },
          { name: "amount_paid", type: "number" },
          { name: "currency", type: "string" },
          { name: "created", type: "number" },
        ],
        subscription: [
          { name: "id", type: "string" },
          { name: "status", type: "string" },
          { name: "created", type: "number" },
        ],
        dispute: [
          { name: "id", type: "string" },
          { name: "reason", type: "string" },
        ],
      };
      const fields = stripeObjectTypes[objectType] ?? [];
      const schema = formatProviderSchema(provider, fields);
      return NextResponse.json({ ok: true, ...schema });
    }

    if (provider === "postgres_readonly") {
      const result = await discoverPostgresSchema(admin, ctx.orgId, objectType);
      if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
      const schema = formatProviderSchema(provider, result.fields);
      return NextResponse.json({ ok: true, ...schema });
    }

    if (provider === "mysql_readonly") {
      const result = await discoverMysqlSchema(admin, ctx.orgId, objectType);
      if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
      const schema = formatProviderSchema(provider, result.fields);
      return NextResponse.json({ ok: true, ...schema });
    }

    if (provider === "snowflake") {
      const result = await discoverSnowflakeSchema(admin, ctx.orgId, objectType);
      if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
      const schema = formatProviderSchema(provider, result.fields);
      return NextResponse.json({ ok: true, ...schema });
    }

    if (provider === "bigquery") {
      const result = await discoverBigQuerySchema(admin, ctx.orgId, objectType);
      if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
      const schema = formatProviderSchema(provider, result.fields);
      return NextResponse.json({ ok: true, ...schema });
    }

    if (provider === "csv") {
      const { fields } = getCsvSchema(objectType);
      const schema = formatProviderSchema(provider, fields);
      return NextResponse.json({ ok: true, ...schema });
    }

    return NextResponse.json({ error: "Provider schema discovery not implemented" }, { status: 501 });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
