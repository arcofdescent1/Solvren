/**
 * Phase 3 — PostgreSQL read-only client.
 */
import pg from "pg";
import { createAdminClient } from "@/lib/supabase/admin";
import { revealCredentialTokenFields } from "@/lib/server/integrationTokenFields";

export type PostgresConfig = {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean | { rejectUnauthorized?: boolean };
};

export async function getPostgresClientForAccount(
  integrationAccountId: string
): Promise<pg.Client | null> {
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
    .eq("provider_key", "postgres_readonly")
    .eq("status", "active")
    .maybeSingle();

  const { data: credsRow } = await admin
    .from("integration_credentials")
    .select("access_token")
    .eq("org_id", orgId)
    .eq("provider", "postgres_readonly")
    .maybeSingle();

  if (!configRow || !credsRow) return null;

  const config = (configRow as { config_json: Record<string, unknown> }).config_json;
  const creds = revealCredentialTokenFields(credsRow as Record<string, unknown>) as { access_token?: string };
  const password = creds.access_token ?? "";
  if (!password) return null;

  const host = (config.host as string) ?? "localhost";
  const port = Number(config.port) || 5432;
  const database = (config.database as string) ?? "";
  const username = (config.username as string) ?? "";
  const ssl = config.ssl === true ? { rejectUnauthorized: false } : config.ssl === "require" ? { rejectUnauthorized: true } : false;

  const client = new pg.Client({
    host,
    port,
    database,
    user: username,
    password,
    ssl: ssl || false,
  });
  return client;
}

export async function executeReadOnlyQuery<T = Record<string, unknown>>(
  client: pg.Client,
  query: string,
  params?: unknown[]
): Promise<{ rows: T[]; error?: string }> {
  try {
    const result = await client.query(query, params);
    return { rows: result.rows as T[] };
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : "Query failed" };
  }
}
