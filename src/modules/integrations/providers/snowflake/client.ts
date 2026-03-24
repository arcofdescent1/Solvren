/**
 * Phase 3 — Snowflake read-only client.
 */
import snowflake from "snowflake-sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { revealCredentialTokenFields } from "@/lib/server/integrationTokenFields";

export type SnowflakeConnection = snowflake.Connection;

export async function getSnowflakeConnectionForAccount(
  integrationAccountId: string
): Promise<SnowflakeConnection | null> {
  const admin = createAdminClient();
  const { data: account } = await admin
    .from("integration_accounts")
    .select("org_id")
    .eq("id", integrationAccountId)
    .maybeSingle();
  if (!account) return null;

  const orgId = (account as { org_id: string }).org_id;

  const { data: configRow } = await admin
    .from("integration_source_configs")
    .select("config_json")
    .eq("integration_account_id", integrationAccountId)
    .eq("provider_key", "snowflake")
    .eq("status", "active")
    .maybeSingle();

  const { data: credsRow } = await admin
    .from("integration_credentials")
    .select("access_token, client_secret")
    .eq("org_id", orgId)
    .eq("provider", "snowflake")
    .maybeSingle();

  if (!configRow || !credsRow) return null;

  const config = (configRow as { config_json: Record<string, unknown> }).config_json;
  const creds = revealCredentialTokenFields(credsRow as Record<string, unknown>) as { access_token?: string; client_secret?: string };
  const password = creds.access_token ?? creds.client_secret ?? "";
  if (!password) return null;

  return new Promise((resolve) => {
    const conn = snowflake.createConnection({
      account: config.account as string,
      username: config.username as string,
      password,
      database: config.database as string,
      schema: (config.schema as string) ?? "PUBLIC",
      warehouse: config.warehouse as string,
    });
    conn.connect((err) => {
      if (err) {
        resolve(null);
        return;
      }
      resolve(conn);
    });
  });
}

export function executeSnowflakeQuery(
  conn: SnowflakeConnection,
  sql: string,
  binds?: snowflake.Binds
): Promise<{ rows: Record<string, unknown>[]; error?: string }> {
  return new Promise((resolve) => {
    conn.execute({
      sqlText: sql,
      binds: binds ?? undefined,
      complete: (err, stmt, rows) => {
        if (err) {
          resolve({ rows: [], error: err.message });
          return;
        }
        resolve({ rows: (rows ?? []) as Record<string, unknown>[] });
      },
    });
  });
}
