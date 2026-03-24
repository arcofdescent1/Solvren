/**
 * Phase 3 — MySQL read-only client.
 */
import mysql from "mysql2/promise";
import { createAdminClient } from "@/lib/supabase/admin";
import { revealCredentialTokenFields } from "@/lib/server/integrationTokenFields";

export async function getMysqlClientForAccount(
  integrationAccountId: string
): Promise<mysql.Connection | null> {
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
    .eq("provider_key", "mysql_readonly")
    .eq("status", "active")
    .maybeSingle();

  const { data: credsRow } = await admin
    .from("integration_credentials")
    .select("access_token")
    .eq("org_id", orgId)
    .eq("provider", "mysql_readonly")
    .maybeSingle();

  if (!configRow || !credsRow) return null;

  const config = (configRow as { config_json: Record<string, unknown> }).config_json;
  const creds = revealCredentialTokenFields(credsRow as Record<string, unknown>) as { access_token?: string };
  const password = creds.access_token ?? "";
  if (!password) return null;

  const conn = await mysql.createConnection({
    host: (config.host as string) ?? "localhost",
    port: Number(config.port) || 3306,
    database: (config.database as string) ?? "",
    user: (config.username as string) ?? "",
    password,
  });
  return conn;
}
