/**
 * Phase 2 — Schema discovery for DB/warehouse providers.
 * Returns column metadata for mapping UI.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAccountByOrgAndProvider } from "@/modules/integrations/core/integrationAccountsRepo";
import { getPostgresClientForAccount, executeReadOnlyQuery } from "@/modules/integrations/providers/postgres-readonly/client";
import { getMysqlClientForAccount } from "@/modules/integrations/providers/mysql-readonly/client";
import { getSnowflakeConnectionForAccount, executeSnowflakeQuery } from "@/modules/integrations/providers/snowflake/client";
import { getBigQueryClientForAccount } from "@/modules/integrations/providers/bigquery/client";

export type SchemaField = { name: string; type: string; label?: string };

const SAFE_TABLE_NAME = /^[a-zA-Z0-9_]+$/;
const SAFE_SCHEMA_TABLE = /^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)?$/;

function validateTableName(name: string): string | null {
  if (!name) return null;
  if (SAFE_SCHEMA_TABLE.test(name)) return name;
  if (SAFE_TABLE_NAME.test(name)) return name;
  return null;
}

function pgTypeToSimple(dataType: string): string {
  const t = (dataType ?? "").toLowerCase();
  if (["integer", "bigint", "smallint", "serial", "bigserial", "real", "double precision", "numeric", "decimal"].some((x) => t.includes(x))) return "number";
  if (["boolean", "bool"].includes(t)) return "boolean";
  if (["timestamp", "timestamptz", "date", "time"].some((x) => t.includes(x))) return "date";
  return "string";
}

function mysqlTypeToSimple(dataType: string): string {
  const t = (dataType ?? "").toLowerCase();
  if (["int", "bigint", "smallint", "tinyint", "mediumint", "decimal", "numeric", "float", "double"].some((x) => t.includes(x))) return "number";
  if (t.includes("bool")) return "boolean";
  if (["date", "datetime", "timestamp", "time"].some((x) => t.includes(x))) return "date";
  return "string";
}

export async function discoverPostgresSchema(
  admin: SupabaseClient,
  orgId: string,
  tableName: string
): Promise<{ fields: SchemaField[] } | { error: string }> {
  if (!validateTableName(tableName)) return { error: "Invalid table name" };
  const { data: account } = await getAccountByOrgAndProvider(admin, orgId, "postgres_readonly");
  if (!account) return { error: "PostgreSQL not connected" };

  const client = await getPostgresClientForAccount(account.id);
  if (!client) return { error: "Failed to connect to PostgreSQL" };

  try {
    await client.connect();
    const schema = tableName.includes(".") ? tableName.split(".")[0]! : "public";
    const table = tableName.includes(".") ? tableName.split(".")[1]! : tableName;
    const { rows, error } = await executeReadOnlyQuery<{ column_name: string; data_type: string }>(
      client,
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`,
      [schema, table]
    );
    await client.end();
    if (error) return { error };
    if (!rows || rows.length === 0) return { error: `Table "${schema}"."${table}" not found` };
    const fields: SchemaField[] = rows.map((r) => ({
      name: r.column_name,
      type: pgTypeToSimple(r.data_type),
    }));
    return { fields };
  } catch (e) {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
    return { error: e instanceof Error ? e.message : "Schema discovery failed" };
  }
}

export async function discoverMysqlSchema(
  admin: SupabaseClient,
  orgId: string,
  tableName: string
): Promise<{ fields: SchemaField[] } | { error: string }> {
  if (!validateTableName(tableName)) return { error: "Invalid table name" };
  const { data: account } = await getAccountByOrgAndProvider(admin, orgId, "mysql_readonly");
  if (!account) return { error: "MySQL not connected" };

  const conn = await getMysqlClientForAccount(account.id);
  if (!conn) return { error: "Failed to connect to MySQL" };

  try {
    const [rows] = (await conn.query(
      "SELECT COLUMN_NAME as column_name, DATA_TYPE as data_type FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION",
      [tableName]
    )) as [Array<{ column_name: string; data_type: string }>, unknown];
    await conn.end();
    const arr = Array.isArray(rows) ? rows : [];
    if (arr.length === 0) return { error: `Table "${tableName}" not found` };
    const fields: SchemaField[] = arr.map((r) => ({
      name: r.column_name,
      type: mysqlTypeToSimple(r.data_type),
    }));
    return { fields };
  } catch (e) {
    try {
      await conn.end();
    } catch {
      /* ignore */
    }
    return { error: e instanceof Error ? e.message : "Schema discovery failed" };
  }
}

export async function discoverSnowflakeSchema(
  admin: SupabaseClient,
  orgId: string,
  tableName: string
): Promise<{ fields: SchemaField[] } | { error: string }> {
  const { data: account } = await getAccountByOrgAndProvider(admin, orgId, "snowflake");
  if (!account) return { error: "Snowflake not connected" };

  const { data: configRow } = await admin
    .from("integration_source_configs")
    .select("config_json")
    .eq("integration_account_id", account.id)
    .eq("provider_key", "snowflake")
    .eq("status", "active")
    .maybeSingle();
  if (!configRow) return { error: "Snowflake config not found" };

  const config = (configRow as { config_json: Record<string, unknown> }).config_json;
  const schema = (config.schema as string) ?? "PUBLIC";

  const conn = await getSnowflakeConnectionForAccount(account.id);
  if (!conn) return { error: "Failed to connect to Snowflake" };

  const { rows, error } = await executeSnowflakeQuery(
    conn,
    `SELECT COLUMN_NAME as "column_name", DATA_TYPE as "data_type" FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = '${schema.replace(/'/g, "''")}' AND TABLE_NAME = '${tableName.replace(/'/g, "''")}' ORDER BY ORDINAL_POSITION`
  );
  conn.destroy((err) => {
    if (err) {
      /* ignore */
    }
  });
  if (error) return { error };
  if (!rows || rows.length === 0) return { error: `Table "${schema}"."${tableName}" not found` };

  const fields: SchemaField[] = rows.map((r) => ({
    name: String((r as Record<string, unknown>).column_name ?? ""),
    type: pgTypeToSimple(String((r as Record<string, unknown>).data_type ?? "string")),
  }));
  return { fields };
}

export async function discoverBigQuerySchema(
  admin: SupabaseClient,
  orgId: string,
  tableName: string
): Promise<{ fields: SchemaField[] } | { error: string }> {
  if (!validateTableName(tableName)) return { error: "Invalid table name" };
  const { data: account } = await getAccountByOrgAndProvider(admin, orgId, "bigquery");
  if (!account) return { error: "BigQuery not connected" };

  const { data: configRow } = await admin
    .from("integration_source_configs")
    .select("config_json")
    .eq("integration_account_id", account.id)
    .eq("provider_key", "bigquery")
    .eq("status", "active")
    .maybeSingle();
  if (!configRow) return { error: "BigQuery config not found" };

  const config = (configRow as { config_json: Record<string, unknown> }).config_json;
  const projectId = config.projectId as string;
  const dataset = (config.dataset as string) ?? (config.datasetId as string);
  if (!projectId || !dataset) return { error: "BigQuery projectId and dataset required in config" };

  const client = await getBigQueryClientForAccount(account.id);
  if (!client) return { error: "Failed to connect to BigQuery" };

  try {
    const [meta] = await client.dataset(dataset).table(tableName).getMetadata();
    const schema = meta.schema?.fields ?? [];
    const fields: SchemaField[] = schema.map((f: { name?: string; type?: string }) => ({
      name: f.name ?? "",
      type: bqTypeToSimple(f.type ?? "STRING"),
    }));
    return { fields };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Schema discovery failed" };
  }
}

function bqTypeToSimple(bqType: string): string {
  const t = (bqType ?? "").toUpperCase();
  if (["INTEGER", "INT64", "FLOAT", "FLOAT64", "NUMERIC", "BIGNUMERIC"].includes(t)) return "number";
  if (["BOOL", "BOOLEAN"].includes(t)) return "boolean";
  if (["DATE", "DATETIME", "TIMESTAMP", "TIME"].includes(t)) return "date";
  return "string";
}

/** Static CSV schema by object type — common column names for mapping UI. */
const CSV_OBJECT_SCHEMAS: Record<string, SchemaField[]> = {
  generic: [
    { name: "id", type: "string" },
    { name: "email", type: "string" },
    { name: "name", type: "string" },
    { name: "created_at", type: "date" },
  ],
  customers: [
    { name: "id", type: "string" },
    { name: "customer_id", type: "string" },
    { name: "email", type: "string" },
    { name: "name", type: "string" },
    { name: "first_name", type: "string" },
    { name: "last_name", type: "string" },
    { name: "created_at", type: "date" },
  ],
  transactions: [
    { name: "id", type: "string" },
    { name: "transaction_id", type: "string" },
    { name: "amount", type: "number" },
    { name: "currency", type: "string" },
    { name: "customer_id", type: "string" },
    { name: "date", type: "date" },
    { name: "created_at", type: "date" },
  ],
  subscriptions: [
    { name: "id", type: "string" },
    { name: "subscription_id", type: "string" },
    { name: "customer_id", type: "string" },
    { name: "status", type: "string" },
    { name: "plan", type: "string" },
    { name: "current_period_start", type: "date" },
    { name: "current_period_end", type: "date" },
  ],
};

export function getCsvSchema(objectType: string): { fields: SchemaField[] } {
  const fields = CSV_OBJECT_SCHEMAS[objectType] ?? CSV_OBJECT_SCHEMAS.generic;
  return { fields };
}
