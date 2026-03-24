/**
 * Phase 3 — CSV connector runtime.
 * No OAuth; setup = create account + configure file import.
 */
import type { ConnectorRuntime } from "../../contracts/runtime";
import { createAdminClient } from "@/lib/supabase/admin";
import { CSV_OBJECT_TYPES } from "./schema";
import { previewCsv } from "./parser";
import { processCsvFile } from "./sync";
import { getAccountById } from "../../core/integrationAccountsRepo";

async function resolveOrgId(integrationAccountId: string): Promise<string | null> {
  const { data } = await getAccountById(createAdminClient(), integrationAccountId);
  return (data as { org_id?: string } | null)?.org_id ?? null;
}

export function getCsvRuntime(): ConnectorRuntime {
  return {
    async connect() {
      return { authUrl: "", stateToken: "", expiresAt: new Date().toISOString() };
    },
    async handleCallback() {
      return { success: false, errorCode: "not_applicable", errorMessage: "CSV does not use OAuth" };
    },
    async disconnect() {},
    async refreshAuth() {
      return { success: false, errorCode: "not_applicable" };
    },
    async testConnection(input) {
      const orgId = await resolveOrgId(input.integrationAccountId);
      return orgId
        ? { success: true, message: "CSV source configured" }
        : { success: false, message: "Account not found" };
    },
    async getHealth(input) {
      const orgId = await resolveOrgId(input.integrationAccountId);
      return {
        status: orgId ? "healthy" : "unhealthy",
        dimensions: { schema_validity: "healthy" },
        lastCheckedAt: new Date().toISOString(),
      };
    },
    async fetchSchema() {
      return {
        objectTypes: CSV_OBJECT_TYPES,
        objectFields: { generic: [], customers: [], transactions: [], subscriptions: [] },
      };
    },
    async runBackfill() {
      return { jobId: "", status: "queued", error: "CSV backfill via file upload; use process endpoint" };
    },
    async runIncrementalSync() {
      return { jobId: "", status: "queued", error: "CSV incremental not supported; upload new file" };
    },
    async receiveWebhook() {
      return { received: false, processedStatus: "received", error: "CSV does not receive webhooks" };
    },
    async reconcileWebhooks() {
      return { success: false, error: "Not applicable" };
    },
    async executeAction() {
      return { success: false, errorCode: "not_implemented", errorMessage: "CSV has no actions" };
    },
    async previewSourceData(input) {
      const config = input.config as { content?: string; storagePath?: string; limit?: number } | undefined;
      const content = config?.content;
      if (!content) {
        return { rows: [], error: "No content provided; upload file first" };
      }
      const limit = input.limit ?? config?.limit ?? 25;
      const result = previewCsv(content, limit);
      return {
        rows: result.rows,
        columns: result.columns.map((c) => ({ name: c, type: "string" })),
        error: result.errors.length ? result.errors.map((e) => `Row ${e.row}: ${e.message}`).join("; ") : undefined,
      };
    },
    async getCheckpoint() {
      return { checkpoint: undefined, error: "CSV does not use checkpoints" };
    },
  };
}

export { processCsvFile };
