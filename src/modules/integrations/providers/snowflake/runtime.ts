/**
 * Phase 3 — Snowflake connector runtime.
 */
import type { ConnectorRuntime } from "../../contracts/runtime";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccountById } from "../../core/integrationAccountsRepo";
import { getSnowflakeConnectionForAccount, executeSnowflakeQuery } from "./client";
import { mapPayloadToCanonicalForIngestion } from "@/lib/integrations/mapping/ingestionBridge";
import { persistWebhookToRawEvents } from "@/modules/signals/ingestion/webhook-to-raw-event.bridge";
import { SNOWFLAKE_OBJECT_TYPES } from "./schema";
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
    .eq("provider_key", "snowflake")
    .maybeSingle();
  return (data as { config_json?: Record<string, unknown> } | null)?.config_json ?? {};
}

export function getSnowflakeRuntime(): ConnectorRuntime {
  return {
    async connect() {
      return { authUrl: "", stateToken: "", expiresAt: new Date().toISOString() };
    },
    async handleCallback() {
      return { success: false, errorCode: "not_applicable", errorMessage: "Snowflake uses config" };
    },
    async disconnect(input) {
      const admin = createAdminClient();
      const orgId = await resolveOrgId(input.integrationAccountId);
      if (!orgId) return;
      await admin.from("integration_credentials").delete().eq("org_id", orgId).eq("provider", "snowflake");
      await admin.from("integration_source_configs").delete().eq("integration_account_id", input.integrationAccountId);
    },
    async refreshAuth() {
      return { success: false, errorCode: "not_applicable" };
    },
    async testConnection(input) {
      const conn = await getSnowflakeConnectionForAccount(input.integrationAccountId);
      if (!conn) return { success: false, message: "Snowflake not configured" };
      const { rows, error } = await executeSnowflakeQuery(conn, "SELECT 1");
      if (error) return { success: false, message: error };
      conn.destroy((err) => { if (err) {/* ignore */} });
      return { success: true, message: "Connected" };
    },
    async getHealth(input) {
      const conn = await getSnowflakeConnectionForAccount(input.integrationAccountId);
      if (!conn) {
        return { status: "unhealthy", dimensions: { connectivity: "unhealthy" }, lastCheckedAt: new Date().toISOString() };
      }
      const { error } = await executeSnowflakeQuery(conn, "SELECT 1");
      conn.destroy((err) => { if (err) {/* ignore */} });
      return {
        status: error ? "unhealthy" : "healthy",
        dimensions: { connectivity: error ? "unhealthy" : "healthy" },
        lastCheckedAt: new Date().toISOString(),
      };
    },
    async fetchSchema() {
      return { objectTypes: SNOWFLAKE_OBJECT_TYPES };
    },
    async runBackfill(input) {
      const admin = createAdminClient();
      const orgId = await resolveOrgId(input.integrationAccountId);
      if (!orgId) return { jobId: "", status: "queued", error: "Account not found" };

      const conn = await getSnowflakeConnectionForAccount(input.integrationAccountId);
      if (!conn) return { jobId: "", status: "queued", error: "Snowflake not configured" };

      const config = await getConfig(input.integrationAccountId);
      const tableName = (config.table as string) ?? "";
      const objectType = (config.objectType as string) ?? "table";
      const schema = (config.schema as string) ?? "PUBLIC";
      const fullTable = `"${schema}"."${tableName}"`;

      const { rows, error } = await executeSnowflakeQuery(conn, `SELECT * FROM ${fullTable} LIMIT 500`);
      conn.destroy((err) => { if (err) {/* ignore */} });

      if (error) return { jobId: "", status: "queued", error };
      let rowsMapped = 0;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const mapped = await mapPayloadToCanonicalForIngestion(admin, {
          orgId,
          providerKey: "snowflake",
          sourceObjectType: objectType,
          payload: row,
        });
        if (mapped.mapped) {
          const extId = String((row as Record<string, unknown>).ID ?? (row as Record<string, unknown>).id ?? i);
          await persistWebhookToRawEvents(admin, {
            orgId,
            integrationAccountId: input.integrationAccountId,
            provider: "snowflake" as IntegrationProvider,
            sourceChannel: "warehouse",
            externalEventId: `sf-${tableName}-${extId}`,
            externalObjectType: objectType,
            externalObjectId: extId,
            eventType: `${objectType}.warehouse_sync`,
            payload: row,
            canonicalOutput: mapped.canonical,
          });
          rowsMapped++;
        }
      }
      return { jobId: `backfill-${Date.now()}`, status: "running" };
    },
    async runIncrementalSync() {
      return { jobId: "", status: "queued", error: "Incremental: configure updated_at column" };
    },
    async receiveWebhook() {
      return { received: false, processedStatus: "received", error: "N/A" };
    },
    async reconcileWebhooks() {
      return { success: false, error: "N/A" };
    },
    async executeAction() {
      return { success: false, errorCode: "not_implemented", errorMessage: "Read-only" };
    },
    async previewSourceData(input) {
      const conn = await getSnowflakeConnectionForAccount(input.integrationAccountId);
      if (!conn) return { rows: [], error: "Snowflake not configured" };
      const config = (input.config ?? (await getConfig(input.integrationAccountId))) as Record<string, unknown>;
      const tableName = (config.table as string) ?? "";
      const schema = (config.schema as string) ?? "PUBLIC";
      const limit = input.limit ?? 25;
      const { rows, error } = await executeSnowflakeQuery(conn, `SELECT * FROM "${schema}"."${tableName}" LIMIT ${limit}`);
      conn.destroy((err) => { if (err) {/* ignore */} });
      return { rows: rows ?? [], error };
    },
  };
}
