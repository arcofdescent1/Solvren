/**
 * Phase 3 — MySQL read-only connector runtime.
 */
import type { ConnectorRuntime } from "../../contracts/runtime";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccountById } from "../../core/integrationAccountsRepo";
import { mapPayloadToCanonicalForIngestion } from "@/lib/integrations/mapping/ingestionBridge";
import { persistWebhookToRawEvents } from "@/modules/signals/ingestion/webhook-to-raw-event.bridge";
import { getCheckpoint } from "../../scheduling/checkpointManager";
import { getMysqlClientForAccount } from "./client";
import { MYSQL_OBJECT_TYPES } from "./schema";
import type { IntegrationProvider } from "../../contracts/types";

async function resolveOrgId(integrationAccountId: string): Promise<string | null> {
  const { data } = await getAccountById(createAdminClient(), integrationAccountId);
  return (data as { org_id?: string } | null)?.org_id ?? null;
}

async function getConfig(integrationAccountId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("integration_source_configs")
    .select("config_json")
    .eq("integration_account_id", integrationAccountId)
    .eq("provider_key", "mysql_readonly")
    .maybeSingle();
  return (data as { config_json?: Record<string, unknown> } | null)?.config_json ?? {};
}

export function getMysqlReadonlyRuntime(): ConnectorRuntime {
  return {
    async connect() {
      return { authUrl: "", stateToken: "", expiresAt: new Date().toISOString() };
    },
    async handleCallback() {
      return { success: false, errorCode: "not_applicable", errorMessage: "MySQL uses config; configure via setup" };
    },
    async disconnect(input) {
      const admin = createAdminClient();
      const orgId = await resolveOrgId(input.integrationAccountId);
      if (!orgId) return;
      await admin.from("integration_credentials").delete().eq("org_id", orgId).eq("provider", "mysql_readonly");
      await admin.from("integration_source_configs").delete().eq("integration_account_id", input.integrationAccountId);
    },
    async refreshAuth() {
      return { success: false, errorCode: "not_applicable" };
    },
    async testConnection(input) {
      const conn = await getMysqlClientForAccount(input.integrationAccountId);
      if (!conn) return { success: false, message: "MySQL not configured" };
      try {
        await conn.ping();
        await conn.end();
        return { success: true, message: "Connected" };
      } catch (e) {
        return { success: false, message: e instanceof Error ? e.message : "Connection failed" };
      }
    },
    async getHealth(input) {
      const conn = await getMysqlClientForAccount(input.integrationAccountId);
      if (!conn) {
        return { status: "unhealthy", dimensions: { connectivity: "unhealthy" }, lastCheckedAt: new Date().toISOString() };
      }
      try {
        await conn.ping();
        await conn.end();
        return { status: "healthy", dimensions: { connectivity: "healthy" }, lastCheckedAt: new Date().toISOString() };
      } catch {
        return { status: "unhealthy", dimensions: { connectivity: "unhealthy" }, lastCheckedAt: new Date().toISOString() };
      }
    },
    async fetchSchema() {
      return { objectTypes: MYSQL_OBJECT_TYPES };
    },
    async runBackfill(input) {
      const admin = createAdminClient();
      const orgId = await resolveOrgId(input.integrationAccountId);
      if (!orgId) return { jobId: "", status: "queued", error: "Account not found" };

      const conn = await getMysqlClientForAccount(input.integrationAccountId);
      if (!conn) return { jobId: "", status: "queued", error: "MySQL not configured" };

      const config = await getConfig(input.integrationAccountId);
      const tableName = (config.table as string) ?? (config.sourceTable as string) ?? "";
      const objectType = (config.objectType as string) ?? "table";
      const columns = ((config.columns as string[]) ?? []) as string[];
      const colList = columns.length > 0 ? columns.map((c) => "`" + c + "`").join(", ") : "*";

      try {
        const [rows] = await conn.query(`SELECT ${colList} FROM \`${tableName}\` LIMIT 500`) as [Record<string, unknown>[], unknown];
        const rowList = Array.isArray(rows) ? rows : [];
        for (let i = 0; i < rowList.length; i++) {
          const row = rowList[i] as Record<string, unknown>;
          const mapped = await mapPayloadToCanonicalForIngestion(admin, {
            orgId,
            providerKey: "mysql_readonly",
            sourceObjectType: objectType,
            payload: row,
          });
          if (mapped.mapped) {
            const extId = String(row.id ?? row.ID ?? i);
            await persistWebhookToRawEvents(admin, {
              orgId,
              integrationAccountId: input.integrationAccountId,
              provider: "mysql_readonly" as IntegrationProvider,
              sourceChannel: "db_read",
              externalEventId: `mysql-${tableName}-${extId}`,
              externalObjectType: objectType,
              externalObjectId: extId,
              eventType: `${objectType}.db_sync`,
              payload: row,
              canonicalOutput: mapped.canonical,
            });
          }
        }
        await conn.end();
        return { jobId: `backfill-${Date.now()}`, status: "running" };
      } catch (e) {
        return { jobId: "", status: "queued", error: e instanceof Error ? e.message : "Backfill failed" };
      }
    },
    async runIncrementalSync() {
      return { jobId: "", status: "queued", error: "Incremental sync: use checkpoint with updated_at column" };
    },
    async receiveWebhook() {
      return { received: false, processedStatus: "received", error: "MySQL does not receive webhooks" };
    },
    async reconcileWebhooks() {
      return { success: false, error: "Not applicable" };
    },
    async executeAction() {
      return { success: false, errorCode: "not_implemented", errorMessage: "MySQL is read-only" };
    },
    async previewSourceData(input) {
      const conn = await getMysqlClientForAccount(input.integrationAccountId);
      if (!conn) return { rows: [], error: "MySQL not configured" };

      const config = (input.config ?? (await getConfig(input.integrationAccountId))) as Record<string, unknown>;
      const tableName = (config.table as string) ?? (config.sourceTable as string) ?? "";
      const columns = ((config.columns as string[]) ?? []) as string[];
      const colList = columns.length > 0 ? columns.map((c) => "`" + c + "`").join(", ") : "*";
      const limit = input.limit ?? 25;

      try {
        const [rows] = await conn.query(`SELECT ${colList} FROM \`${tableName}\` LIMIT ?`, [limit]);
        await conn.end();
        return {
          rows: rows as unknown[],
          columns: columns.length > 0 ? columns.map((c) => ({ name: c, type: "string" })) : undefined,
        };
      } catch (e) {
        return { rows: [], error: e instanceof Error ? e.message : "Preview failed" };
      }
    },
    async getCheckpoint(input) {
      const admin = createAdminClient();
      const config = await getConfig(input.integrationAccountId);
      const objectType = (config.objectType as string) ?? input.sourceObjectType ?? "table";
      const result = await getCheckpoint(admin, {
        integrationAccountId: input.integrationAccountId,
        sourceObjectType: objectType,
      });
      return { checkpoint: result.checkpoint ?? undefined, error: result.error };
    },
    async fetchSourceMetadata(input) {
      const conn = await getMysqlClientForAccount(input.integrationAccountId);
      if (!conn) return { error: "MySQL not configured" };
      try {
        const [rows] = await conn.query("SHOW TABLES");
        await conn.end();
        const tables = (rows as Record<string, unknown>[]).map((r, i) => ({
          key: String(Object.values(r)[0] ?? `table_${i}`),
          label: String(Object.values(r)[0] ?? `table_${i}`),
        }));
        return { objectTypes: tables };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Schema fetch failed" };
      }
    },
  };
}
