/**
 * Phase 2 — Stripe connect: store API key + webhook secret.
 * GET: status; POST: save credentials.
 */
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { sealCredentialTokenFields } from "@/lib/server/integrationTokenFields";
import { getAccountByOrgAndProvider, insertIntegrationAccount, updateIntegrationAccount } from "@/modules/integrations/core/integrationAccountsRepo";

export async function GET(req: NextRequest) {
  try {
    const orgIdRaw = req.nextUrl.searchParams.get("orgId");
    if (!orgIdRaw) return NextResponse.json({ error: "orgId required" }, { status: 400 });
    const ctx = await requireOrgPermission(parseRequestedOrgId(orgIdRaw), "integrations.view");
    const admin = createAdminClient();
    const { data: conn } = await admin
      .from("integration_connections")
      .select("status, config")
      .eq("org_id", ctx.orgId)
      .eq("provider", "stripe")
      .maybeSingle();
    const { data: creds } = await admin
      .from("integration_credentials")
      .select("id")
      .eq("org_id", ctx.orgId)
      .eq("provider", "stripe")
      .maybeSingle();
    const connected = !!creds && (conn as { status?: string } | null)?.status === "connected";
    const config = (conn as { config?: { webhookConfigured?: boolean } } | null)?.config ?? {};
    return NextResponse.json({
      connected,
      webhookConfigured: config.webhookConfigured ?? false,
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as {
      orgId?: string;
      secretKey?: string;
      webhookSecret?: string;
    };
    const orgIdRaw = body.orgId ?? req.nextUrl.searchParams.get("orgId");
    if (!orgIdRaw) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    const ctx = await requireOrgPermission(parseRequestedOrgId(orgIdRaw), "integrations.manage");
    if (!body.secretKey?.trim()) return NextResponse.json({ error: "secretKey required" }, { status: 400 });

    const stripe = new Stripe(body.secretKey.trim(), {
      apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
    });
    try {
      await stripe.accounts.retrieve();
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Invalid API key" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const credsPayload: Record<string, unknown> = {
      org_id: ctx.orgId,
      provider: "stripe",
      access_token: body.secretKey.trim(),
    };
    if (body.webhookSecret?.trim()) {
      credsPayload.client_secret = body.webhookSecret.trim();
    }

    await admin.from("integration_credentials").upsert(
      sealCredentialTokenFields(credsPayload),
      { onConflict: "org_id,provider" }
    );

    await admin.from("integration_connections").upsert(
      {
        org_id: ctx.orgId,
        provider: "stripe",
        status: "connected",
        config: { webhookConfigured: Boolean(body.webhookSecret?.trim()) },
      },
      { onConflict: "org_id,provider" }
    );

    const { data: existing } = await getAccountByOrgAndProvider(admin, ctx.orgId, "stripe");
    if (existing) {
      await updateIntegrationAccount(admin, existing.id, {
        status: "connected",
        installed_at: new Date().toISOString(),
        installed_by_user_id: ctx.user.id,
        disconnected_at: null,
        last_success_at: new Date().toISOString(),
        last_error_at: null,
        last_error_code: null,
        last_error_message: null,
        config_json: { webhookConfigured: Boolean(body.webhookSecret?.trim()) },
      });
    } else {
      await insertIntegrationAccount(admin, {
        org_id: ctx.orgId,
        provider: "stripe",
        display_name: "Stripe",
        category: "payments",
        auth_type: "api_key",
        status: "connected",
        connection_mode: "api_key",
        installed_by_user_id: ctx.user.id,
        installed_at: new Date().toISOString(),
        disconnected_at: null,
        last_success_at: new Date().toISOString(),
        last_error_at: null,
        last_error_code: null,
        last_error_message: null,
        health_summary_json: {},
        scopes_granted_json: [],
        scopes_missing_json: [],
        config_json: { webhookConfigured: Boolean(body.webhookSecret?.trim()) },
        secrets_ref: null,
        metadata_json: {},
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
