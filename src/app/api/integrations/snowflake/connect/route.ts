/**
 * Phase 3 — Snowflake connect: store config + credentials.
 */
import { NextRequest, NextResponse } from "next/server";
import snowflake from "snowflake-sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { sealCredentialTokenFields } from "@/lib/server/integrationTokenFields";
import { getAccountByOrgAndProvider, insertIntegrationAccount, updateIntegrationAccount } from "@/modules/integrations/core/integrationAccountsRepo";

function testSnowflakeConnection(config: {
  account: string;
  username: string;
  password: string;
  database: string;
  schema?: string;
  warehouse: string;
}): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const conn = snowflake.createConnection({
      account: config.account,
      username: config.username,
      password: config.password,
      database: config.database,
      schema: config.schema ?? "PUBLIC",
      warehouse: config.warehouse,
    });
    conn.connect((err) => {
      if (err) {
        resolve({ ok: false, error: err.message });
        return;
      }
      conn.execute({
        sqlText: "SELECT 1",
        complete: (e) => {
          conn.destroy((destroyErr) => {
            if (destroyErr) {
              /* ignore */
            }
            resolve(e ? { ok: false, error: e.message } : { ok: true });
          });
        },
      });
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as {
      orgId?: string;
      account?: string;
      username?: string;
      password?: string;
      database?: string;
      schema?: string;
      warehouse?: string;
      table?: string;
      objectType?: string;
    };

    const orgIdRaw = body.orgId ?? req.nextUrl.searchParams.get("orgId");
    if (!orgIdRaw) return NextResponse.json({ error: "orgId required" }, { status: 400 });
    const ctx = await requireOrgPermission(parseRequestedOrgId(orgIdRaw), "integrations.manage");

    if (!body.account || !body.username || !body.password || !body.database || !body.warehouse) {
      return NextResponse.json(
        { error: "account, username, password, database, warehouse required" },
        { status: 400 }
      );
    }

    const test = await testSnowflakeConnection({
      account: body.account,
      username: body.username,
      password: body.password,
      database: body.database,
      schema: body.schema ?? "PUBLIC",
      warehouse: body.warehouse,
    });
    if (!test.ok) {
      return NextResponse.json({ error: test.error ?? "Connection failed" }, { status: 400 });
    }

    const admin = createAdminClient();

    await admin.from("integration_credentials").upsert(
      sealCredentialTokenFields({
        org_id: ctx.orgId,
        provider: "snowflake",
        access_token: body.password,
      }),
      { onConflict: "org_id,provider" }
    );

    const configJson = {
      account: body.account,
      username: body.username,
      database: body.database,
      schema: body.schema ?? "PUBLIC",
      warehouse: body.warehouse,
      table: body.table,
      objectType: body.objectType ?? "table",
    };

    const { data: existing } = await getAccountByOrgAndProvider(admin, ctx.orgId, "snowflake");
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
        provider: "snowflake",
        display_name: "Snowflake",
        category: "warehouse",
        auth_type: "basic",
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
      .eq("provider_key", "snowflake");
    await admin.from("integration_source_configs").insert({
      org_id: ctx.orgId,
      provider_key: "snowflake",
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
