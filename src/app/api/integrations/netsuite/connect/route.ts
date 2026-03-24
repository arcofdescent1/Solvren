/**
 * POST /api/integrations/netsuite/connect
 * Store NetSuite credentials and create connection.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { auditLog } from "@/lib/audit";
import { sealCredentialTokenFields } from "@/lib/server/integrationTokenFields";
import { env } from "@/lib/env";
import { linkNetSuiteIntegrationAccount } from "@/modules/integrations/providers/netsuite/accountLink";

export async function POST(req: NextRequest) {
  try {
    if (!env.netsuiteIntegrationEnabled) {
      return NextResponse.json({ error: "NetSuite not configured" }, { status: 503 });
    }

    let body: {
      organizationId?: string;
      accountId?: string;
      consumerKey?: string;
      consumerSecret?: string;
      tokenId?: string;
      tokenSecret?: string;
      environment?: "production" | "sandbox";
    };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const orgId = body.organizationId ?? req.nextUrl.searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "organizationId required" }, { status: 400 });
    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.manage");
    const admin = createAdminClient();

    const accountId = body.accountId?.trim();
    const consumerKey = body.consumerKey?.trim() ?? body.tokenId;
    const consumerSecret = body.consumerSecret?.trim() ?? body.tokenSecret;

    if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });

    if (!consumerKey || !consumerSecret) {
      return NextResponse.json(
        { error: "consumerKey and consumerSecret (or tokenId and tokenSecret) required" },
        { status: 400 }
      );
    }

    const environment = body.environment ?? "sandbox";
    if (environment !== "production" && environment !== "sandbox") {
      return NextResponse.json({ error: "environment must be production or sandbox" }, { status: 400 });
    }

    const { data: conn } = await admin
      .from("integration_connections")
      .upsert(
        {
          org_id: ctx.orgId,
          provider: "netsuite",
          status: "connected",
          config: { accountId, environment },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "org_id,provider" }
      )
      .select("id")
      .maybeSingle();

    const connId = (conn as { id?: string } | null)?.id;

    await admin.from("netsuite_accounts").upsert(
      {
        org_id: ctx.orgId,
        integration_connection_id: connId ?? null,
        account_id: accountId,
        environment,
        rest_web_services_enabled: true,
        oauth_config_valid: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,account_id" }
    );

    await admin.from("integration_credentials").upsert(
      sealCredentialTokenFields({
        org_id: ctx.orgId,
        provider: "netsuite",
        client_id: consumerKey,
        client_secret: consumerSecret,
        updated_at: new Date().toISOString(),
      }),
      { onConflict: "org_id,provider" }
    );

    await linkNetSuiteIntegrationAccount(admin, {
      orgId: ctx.orgId,
      userId: ctx.user.id,
      accountId,
      environment,
    });

    await auditLog(ctx.supabase, {
      orgId: ctx.orgId,
      actorId: ctx.user.id,
      actorType: "USER",
      action: "netsuite.connected",
      entityType: "integration",
      entityId: "netsuite",
      metadata: { accountId, environment },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
