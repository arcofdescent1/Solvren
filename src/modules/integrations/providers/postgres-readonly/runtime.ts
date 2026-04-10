/**
 * Phase 3 — PostgreSQL read-only connector runtime.
 */
import type { ConnectorRuntime } from "../../contracts/runtime";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccountById } from "../../core/integrationAccountsRepo";
import { getCheckpoint, saveCheckpoint } from "../../scheduling/checkpointManager";
import { getPostgresClientForAccount } from "./client";
import { fetchTableRows, syncPostgresTable } from "./sync";
import { POSTGRES_OBJECT_TYPES } from "./schema";

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
    .eq("provider_key", "postgres_readonly")
    .maybeSingle();
  return (data as { config_json?: Record<string, unknown> } | null)?.config_json ?? {};
}

export function getPostgresReadonlyRuntime(): ConnectorRuntime {
  return {
    async connect() {
      return { authUrl: "", stateToken: "", expiresAt: new Date().toISOString() };
    },
    async handleCallback() {
      return { success: false, errorCode: "not_applicable", errorMessage: "Postgres uses config; configure via setup" };
    },
    async disconnect(input) {
      const admin = createAdminClient();
      const orgId = await resolveOrgId(input.integrationAccountId);
      if (!orgId) return;
      await admin.from("integration_credentials").delete().eq("org_id", orgId).eq("provider", "postgres_readonly");
      await admin.from("integration_source_configs").delete().eq("integration_account_id", input.integrationAccountId);
    },
    async refreshAuth() {
      return { success: false, errorCode: "not_applicable" };
    },
    async testConnection(input) {
      const client = await getPostgresClientForAccount(input.integrationAccountId);
      if (!client) return { success: false, message: "Postgres not configured" };
      try {
        await client.connect();
        await client.query("SELECT 1");
        await client.end();
        return { success: true, message: "Connected" };
      } catch (e) {
        return { success: false, message: e instanceof Error ? e.message : "Connection failed" };
      }
    },
    async getHealth(input) {
      const client = await getPostgresClientForAccount(input.integrationAccountId);
      if (!client) {
        return { status: "unhealthy", dimensions: { connectivity: "unhealthy" }, lastCheckedAt: new Date().toISOString() };
      }
      try {
        await client.connect();
        await client.query("SELECT 1");
        await client.end();
        return { status: "healthy", dimensions: { connectivity: "healthy" }, lastCheckedAt: new Date().toISOString() };
      } catch {
        return { status: "unhealthy", dimensions: { connectivity: "unhealthy" }, lastCheckedAt: new Date().toISOString() };
      }
    },
    async fetchSchema() {
      return { objectTypes: POSTGRES_OBJECT_TYPES };
    },
    async runBackfill(input) {
      const admin = createAdminClient();
      const orgId = await resolveOrgId(input.integrationAccountId);
      if (!orgId) return { jobId: "", status: "queued", error: "Account not found" };

      const client = await getPostgresClientForAccount(input.integrationAccountId);
      if (!client) return { jobId: "", status: "queued", error: "Postgres not configured" };

      const config = await getConfig(input.integrationAccountId);
      const tableName = (config.table as string) ?? (config.sourceTable as string);
      const objectType = (config.objectType as string) ?? "table";
      const columns = ((config.columns as string[]) ?? []) as string[];
      const colList = columns.length > 0 ? columns : ["*"];

      try {
        await client.connect();
        const { rowsProcessed: _rowsProcessed, rowsMapped: _rowsMapped, nextCheckpoint, error } = await syncPostgresTable(admin, {
          orgId,
          integrationAccountId: input.integrationAccountId,
          client,
          tableName: tableName ?? "public",
          objectType,
          columns: colList[0] === "*" ? [] : colList,
          updatedAtColumn: config.updatedAtColumn as string | undefined,
        });
        await client.end();

        if (error) return { jobId: "", status: "queued", error };
        if (nextCheckpoint) {
          await saveCheckpoint(admin, {
            orgId,
            integrationAccountId: input.integrationAccountId,
            sourceObjectType: objectType,
            checkpoint: nextCheckpoint,
          });
        }
        return { jobId: `backfill-${Date.now()}`, status: "running" };
      } catch (e) {
        return { jobId: "", status: "queued", error: e instanceof Error ? e.message : "Backfill failed" };
      }
    },
    async runIncrementalSync(input) {
      const admin = createAdminClient();
      const orgId = await resolveOrgId(input.integrationAccountId);
      if (!orgId) return { jobId: "", status: "queued", error: "Account not found" };

      const config = await getConfig(input.integrationAccountId);
      const objectType = (config.objectType as string) ?? "table";
      const { checkpoint } = await getCheckpoint(admin, {
        integrationAccountId: input.integrationAccountId,
        sourceObjectType: objectType,
      });

      const client = await getPostgresClientForAccount(input.integrationAccountId);
      if (!client) return { jobId: "", status: "queued", error: "Postgres not configured" };

      const tableName = (config.table as string) ?? (config.sourceTable as string);
      const columns = ((config.columns as string[]) ?? []) as string[];

      try {
        await client.connect();
        const { rowsProcessed: _rowsProcessed2, rowsMapped: _rowsMapped2, nextCheckpoint: nextCp, error } = await syncPostgresTable(admin, {
          orgId,
          integrationAccountId: input.integrationAccountId,
          client,
          tableName: tableName ?? "public",
          objectType,
          columns: columns.length > 0 ? columns : [],
          checkpoint: checkpoint ?? undefined,
          updatedAtColumn: config.updatedAtColumn as string | undefined,
        });
        await client.end();

        if (error) return { jobId: "", status: "queued", error };
        if (nextCp) {
          await saveCheckpoint(admin, {
            orgId,
            integrationAccountId: input.integrationAccountId,
            sourceObjectType: objectType,
            checkpoint: nextCp,
          });
        }
        return { jobId: `incr-${Date.now()}`, status: "running", nextCursor: nextCp };
      } catch (e) {
        return { jobId: "", status: "queued", error: e instanceof Error ? e.message : "Incremental sync failed" };
      }
    },
    async receiveWebhook() {
      return { received: false, processedStatus: "received", error: "Postgres does not receive webhooks" };
    },
    async reconcileWebhooks() {
      return { success: false, error: "Not applicable" };
    },
    async executeAction() {
      return { success: false, errorCode: "not_implemented", errorMessage: "Postgres is read-only" };
    },
    async previewSourceData(input) {
      const client = await getPostgresClientForAccount(input.integrationAccountId);
      if (!client) return { rows: [], error: "Postgres not configured" };

      const config = (input.config ?? (await getConfig(input.integrationAccountId))) as Record<string, unknown>;
      const tableName = (config.table as string) ?? (config.sourceTable as string) ?? "public";
      const columns = ((config.columns as string[]) ?? []) as string[];
      const limit = input.limit ?? 25;

      try {
        await client.connect();
        const { rows, error } = await fetchTableRows(client, tableName, columns, undefined, [], limit);
        await client.end();
        return {
          rows,
          columns: columns.length > 0 ? columns.map((c) => ({ name: c, type: "string" })) : undefined,
          error,
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
      const client = await getPostgresClientForAccount(input.integrationAccountId);
      if (!client) return { error: "Postgres not configured" };

      try {
        await client.connect();
        const res = await client.query(
          `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type IN ('BASE TABLE', 'VIEW') LIMIT 50`
        );
        await client.end();
        const tables = (res.rows as { table_name: string }[]).map((r) => ({ key: r.table_name, label: r.table_name }));
        return { objectTypes: tables };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Schema fetch failed" };
      }
    },
  };
}
