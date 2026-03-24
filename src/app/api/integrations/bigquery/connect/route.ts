/**
 * Phase 3 — BigQuery connect: store config + credentials (service account JSON key).
 */
import { NextRequest, NextResponse } from "next/server";
import { BigQuery } from "@google-cloud/bigquery";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { sealCredentialTokenFields } from "@/lib/server/integrationTokenFields";
import { getAccountByOrgAndProvider, insertIntegrationAccount, updateIntegrationAccount } from "@/modules/integrations/core/integrationAccountsRepo";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as {
      orgId?: string;
      projectId?: string;
      credentialsJson?: string | Record<string, unknown>;
      dataset?: string;
      table?: string;
      objectType?: string;
    };

    const orgIdRaw = body.orgId ?? req.nextUrl.searchParams.get("orgId");
    if (!orgIdRaw) return NextResponse.json({ error: "orgId required" }, { status: 400 });
    const ctx = await requireOrgPermission(parseRequestedOrgId(orgIdRaw), "integrations.manage");

    if (!body.projectId || !body.credentialsJson) {
      return NextResponse.json(
        { error: "projectId and credentialsJson (service account JSON) required" },
        { status: 400 }
      );
    }

    let key: Record<string, unknown>;
    try {
      key =
        typeof body.credentialsJson === "string"
          ? (JSON.parse(body.credentialsJson) as Record<string, unknown>)
          : (body.credentialsJson as Record<string, unknown>);
    } catch {
      return NextResponse.json({ error: "Invalid credentials JSON" }, { status: 400 });
    }

    try {
      const bq = new BigQuery({ credentials: key, projectId: body.projectId });
      const [datasets] = await bq.getDatasets({ maxResults: 1 });
      if (!datasets || datasets.length === 0) {
        return NextResponse.json({ error: "No datasets found; verify project and credentials" }, { status: 400 });
      }
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Connection failed" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const keyJson = JSON.stringify(key);

    await admin.from("integration_credentials").upsert(
      sealCredentialTokenFields({
        org_id: ctx.orgId,
        provider: "bigquery",
        access_token: keyJson,
      }),
      { onConflict: "org_id,provider" }
    );

    const configJson = {
      projectId: body.projectId,
      dataset: body.dataset,
      table: body.table,
      objectType: body.objectType ?? "table",
    };

    const { data: existing } = await getAccountByOrgAndProvider(admin, ctx.orgId, "bigquery");
    let accountId: string;

    if (existing) {
      await updateIntegrationAccount(admin, existing.id, {
        status: "connected",
        config_json: configJson,
      });
      accountId = existing.id;
    } else {
      const { data: newAccount, error } = await insertIntegrationAccount(admin, {
        org_id: ctx.orgId,
        provider: "bigquery",
        display_name: "BigQuery",
        category: "warehouse",
        auth_type: "service_account",
        status: "connected",
        connection_mode: "basic",
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
        config_json: configJson,
        secrets_ref: null,
        metadata_json: {},
      });
      if (error || !newAccount)
        return NextResponse.json({ error: error?.message ?? "Failed to create account" }, { status: 500 });
      accountId = newAccount.id;
    }

    await admin
      .from("integration_source_configs")
      .delete()
      .eq("integration_account_id", accountId)
      .eq("provider_key", "bigquery");
    await admin.from("integration_source_configs").insert({
      org_id: ctx.orgId,
      provider_key: "bigquery",
      integration_account_id: accountId,
      config_json: {
        ...configJson,
        sourceTable: body.table,
      },
      status: "active",
      created_by: ctx.user.id,
    });

    return NextResponse.json({ ok: true, accountId });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
