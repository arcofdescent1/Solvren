/**
 * Phase 3 — PostgreSQL sync: backfill and incremental.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type pg from "pg";
import { mapPayloadToCanonicalForIngestion } from "@/lib/integrations/mapping/ingestionBridge";
import { persistWebhookToRawEvents } from "@/modules/signals/ingestion/webhook-to-raw-event.bridge";
import type { IntegrationProvider } from "../../contracts/types";

const ROW_LIMIT = 500;

export async function fetchTableRows(
  client: pg.Client,
  tableName: string,
  columns: string[],
  where?: string,
  params?: unknown[],
  limit = ROW_LIMIT
): Promise<{ rows: Record<string, unknown>[]; error?: string }> {
  const colList = columns.length > 0 ? columns.map((c) => `"${c}"`).join(", ") : "*";
  const whereClause = where ? ` WHERE ${where}` : "";
  const query = `SELECT ${colList} FROM "${tableName}"${whereClause} LIMIT $${(params?.length ?? 0) + 1}`;
  const allParams = [...(params ?? []), limit];

  try {
    const result = await client.query(query, allParams);
    return { rows: result.rows as Record<string, unknown>[] };
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : "Query failed" };
  }
}

export async function syncPostgresTable(
  admin: SupabaseClient,
  params: {
    orgId: string;
    integrationAccountId: string | null;
    client: pg.Client;
    tableName: string;
    objectType: string;
    columns: string[];
    checkpoint?: { lastUpdated?: string; lastId?: string };
    updatedAtColumn?: string;
  }
): Promise<{ rowsProcessed: number; rowsMapped: number; nextCheckpoint?: Record<string, unknown>; error?: string }> {
  const { orgId, integrationAccountId, client, tableName, objectType, columns, checkpoint, updatedAtColumn } = params;
  let where = "";
  const queryParams: unknown[] = [];

  if (updatedAtColumn && checkpoint?.lastUpdated) {
    where = `"${updatedAtColumn}" > $1`;
    queryParams.push(checkpoint.lastUpdated);
  }

  const { rows, error } = await fetchTableRows(client, tableName, columns, where || undefined, queryParams);
  if (error) return { rowsProcessed: 0, rowsMapped: 0, error };

  let rowsMapped = 0;
  let lastUpdated: string | undefined;
  let lastId: string | undefined;

  for (const row of rows) {
    const extId = String((row as Record<string, unknown>).id ?? (row as Record<string, unknown>).ID ?? rows.indexOf(row));
    const mapped = await mapPayloadToCanonicalForIngestion(admin, {
      orgId,
      providerKey: "postgres_readonly",
      sourceObjectType: objectType,
      payload: row,
    });

    if (mapped.mapped) {
      await persistWebhookToRawEvents(admin, {
        orgId,
        integrationAccountId,
        provider: "postgres_readonly" as IntegrationProvider,
        sourceChannel: "db_read",
        externalEventId: `pg-${tableName}-${extId}`,
        externalObjectType: objectType,
        externalObjectId: extId,
        eventType: `${objectType}.db_sync`,
        payload: row,
        canonicalOutput: mapped.canonical,
      });
      rowsMapped++;
    }

    if (updatedAtColumn && (row as Record<string, unknown>)[updatedAtColumn]) {
      lastUpdated = String((row as Record<string, unknown>)[updatedAtColumn]);
    }
    lastId = extId;
  }

  const nextCheckpoint: Record<string, unknown> = {};
  if (lastUpdated) nextCheckpoint.lastUpdated = lastUpdated;
  if (lastId) nextCheckpoint.lastId = lastId;

  return { rowsProcessed: rows.length, rowsMapped, nextCheckpoint: Object.keys(nextCheckpoint).length > 0 ? nextCheckpoint : undefined };
}
