/**
 * Phase 3 — BigQuery connector runtime.
 */
import type { ConnectorRuntime } from "../../contracts/runtime";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccountById } from "../../core/integrationAccountsRepo";
import { getBigQueryClientForAccount } from "./client";
import { mapPayloadToCanonicalForIngestion } from "@/lib/integrations/mapping/ingestionBridge";
import { persistWebhookToRawEvents } from "@/modules/signals/ingestion/webhook-to-raw-event.bridge";
import { BIGQUERY_OBJECT_TYPES } from "./schema";
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
    .eq("provider_key", "bigquery")
    .maybeSingle();
  return (data as { config_json?: Record<string, unknown> } | null)?.config_json ?? {};
}

export function getBigQueryRuntime(): ConnectorRuntime {
  return {
    async connect() {
      return { authUrl: "", stateToken: "", expiresAt: new Date().toISOString() };
    },
    async handleCallback() {
      return { success: false, errorCode: "not_applicable", errorMessage: "BigQuery uses config" };
    },
    async disconnect(input) {
      const admin = createAdminClient();
      const orgId = await resolveOrgId(input.integrationAccountId);
      if (!orgId) return;
      await admin.from("integration_credentials").delete().eq("org_id", orgId).eq("provider", "bigquery");
      await admin.from("integration_source_configs").delete().eq("integration_account_id", input.integrationAccountId);
    },
    async refreshAuth() {
      return { success: false, errorCode: "not_applicable" };
    },
    async testConnection(input) {
      const client = await getBigQueryClientForAccount(input.integrationAccountId);
      if (!client) return { success: false, message: "BigQuery not configured" };
      try {
        const [_rows] = await client.query({ query: "SELECT 1" });
        return { success: true, message: "Connected" };
      } catch (e) {
        return { success: false, message: e instanceof Error ? e.message : "Connection failed" };
      }
    },
    async getHealth(input) {
      const client = await getBigQueryClientForAccount(input.integrationAccountId);
      if (!client) {
        return { status: "unhealthy", dimensions: { connectivity: "unhealthy" }, lastCheckedAt: new Date().toISOString() };
      }
      try {
        await client.query({ query: "SELECT 1" });
        return { status: "healthy", dimensions: { connectivity: "healthy" }, lastCheckedAt: new Date().toISOString() };
      } catch {
        return { status: "unhealthy", dimensions: { connectivity: "unhealthy" }, lastCheckedAt: new Date().toISOString() };
      }
    },
    async fetchSchema() {
      return { objectTypes: BIGQUERY_OBJECT_TYPES };
    },
    async runBackfill(input) {
      const admin = createAdminClient();
      const orgId = await resolveOrgId(input.integrationAccountId);
      if (!orgId) return { jobId: "", status: "queued", error: "Account not found" };

      const client = await getBigQueryClientForAccount(input.integrationAccountId);
      if (!client) return { jobId: "", status: "queued", error: "BigQuery not configured" };

      const config = await getConfig(input.integrationAccountId);
      const dataset = (config.dataset as string) ?? "";
      const table = (config.table as string) ?? "";
      const objectType = (config.objectType as string) ?? "table";
      const fullTable = `\`${dataset}.${table}\``;

      try {
        const [rows] = await client.query({ query: `SELECT * FROM ${fullTable} LIMIT 500` });
        for (let i = 0; i < (rows ?? []).length; i++) {
          const row = (rows as Record<string, unknown>[])[i];
          const mapped = await mapPayloadToCanonicalForIngestion(admin, {
            orgId,
            providerKey: "bigquery",
            sourceObjectType: objectType,
            payload: row,
          });
          if (mapped.mapped) {
            const extId = String((row as Record<string, unknown>).id ?? (row as Record<string, unknown>).ID ?? i);
            await persistWebhookToRawEvents(admin, {
              orgId,
              integrationAccountId: input.integrationAccountId,
              provider: "bigquery" as IntegrationProvider,
              sourceChannel: "warehouse",
              externalEventId: `bq-${table}-${extId}`,
              externalObjectType: objectType,
              externalObjectId: extId,
              eventType: `${objectType}.warehouse_sync`,
              payload: row,
              canonicalOutput: mapped.canonical,
            });
          }
        }
        return { jobId: `backfill-${Date.now()}`, status: "running" };
      } catch (e) {
        return { jobId: "", status: "queued", error: e instanceof Error ? e.message : "Backfill failed" };
      }
    },
    async runIncrementalSync() {
      return { jobId: "", status: "queued", error: "Incremental: configure partition field" };
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
      const client = await getBigQueryClientForAccount(input.integrationAccountId);
      if (!client) return { rows: [], error: "BigQuery not configured" };
      const config = (input.config ?? (await getConfig(input.integrationAccountId))) as Record<string, unknown>;
      const dataset = (config.dataset as string) ?? "";
      const table = (config.table as string) ?? "";
      const limit = input.limit ?? 25;
      const fullTable = `\`${dataset}.${table}\``;
      try {
        const [rows] = await client.query({ query: `SELECT * FROM ${fullTable} LIMIT ${limit}` });
        return { rows: (rows ?? []) as unknown[] };
      } catch (e) {
        return { rows: [], error: e instanceof Error ? e.message : "Preview failed" };
      }
    },
  };
}
