/**
 * Phase 3 — MySQL read-only connect: store config + credentials.
 */
import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { sealCredentialTokenFields } from "@/lib/server/integrationTokenFields";
import { getAccountByOrgAndProvider, insertIntegrationAccount, updateIntegrationAccount } from "@/modules/integrations/core/integrationAccountsRepo";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as {
      orgId?: string;
      host?: string;
      port?: number;
      database?: string;
      username?: string;
      password?: string;
      table?: string;
      columns?: string[];
      primaryKey?: string;
      updatedAtColumn?: string;
      objectType?: string;
    };

    const orgIdRaw = body.orgId ?? req.nextUrl.searchParams.get("orgId");
    if (!orgIdRaw) return NextResponse.json({ error: "orgId required" }, { status: 400 });
    const ctx = await requireOrgPermission(parseRequestedOrgId(orgIdRaw), "integrations.manage");

    if (!body.host || !body.database || !body.username || !body.password) {
      return NextResponse.json({ error: "host, database, username, password required" }, { status: 400 });
    }

    try {
      const conn = await mysql.createConnection({
        host: body.host,
        port: body.port ?? 3306,
        database: body.database,
        user: body.username,
        password: body.password,
      });
      await conn.query("SELECT 1");
      await conn.end();
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Connection failed" }, { status: 400 });
    }

    const admin = createAdminClient();

    await admin.from("integration_credentials").upsert(
      sealCredentialTokenFields({
        org_id: ctx.orgId,
        provider: "mysql_readonly",
        access_token: body.password,
      }),
      { onConflict: "org_id,provider" }
    );

    const { data: existing } = await getAccountByOrgAndProvider(admin, ctx.orgId, "mysql_readonly");
    let accountId: string;

    if (existing) {
      await updateIntegrationAccount(admin, existing.id, {
        status: "connected",
        config_json: {
          host: body.host,
          port: body.port ?? 3306,
          database: body.database,
          username: body.username,
          table: body.table,
          columns: body.columns ?? [],
          primaryKey: body.primaryKey,
          updatedAtColumn: body.updatedAtColumn,
          objectType: body.objectType ?? "table",
        },
      });
      accountId = existing.id;
    } else {
      const { data: newAccount, error } = await insertIntegrationAccount(admin, {
        org_id: ctx.orgId,
        provider: "mysql_readonly",
        display_name: "MySQL",
        category: "database",
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
        config_json: {
          host: body.host,
          port: body.port ?? 3306,
          database: body.database,
          username: body.username,
          table: body.table,
          columns: body.columns ?? [],
          primaryKey: body.primaryKey,
          updatedAtColumn: body.updatedAtColumn,
          objectType: body.objectType ?? "table",
        },
        secrets_ref: null,
        metadata_json: {},
      });
      if (error || !newAccount) return NextResponse.json({ error: error?.message ?? "Failed to create account" }, { status: 500 });
      accountId = newAccount.id;
    }

    await admin.from("integration_source_configs").delete().eq("integration_account_id", accountId).eq("provider_key", "mysql_readonly");
    await admin.from("integration_source_configs").insert({
      org_id: ctx.orgId,
      provider_key: "mysql_readonly",
      integration_account_id: accountId,
      config_json: {
        host: body.host,
        port: body.port ?? 3306,
        database: body.database,
        username: body.username,
        table: body.table,
        columns: body.columns ?? [],
        primaryKey: body.primaryKey,
        updatedAtColumn: body.updatedAtColumn,
        objectType: body.objectType ?? "table",
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
