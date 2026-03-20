/**
 * Phase 1 — Stub ConnectorRuntime for providers not yet migrated.
 * Implements contract; all operations return minimal success or throw.
 */
import type { ConnectorRuntime } from "../../contracts/runtime";
import type { IntegrationProvider } from "../../contracts/types";

export function createStubRuntime(provider: IntegrationProvider): ConnectorRuntime {
  const stub = {
    async connect() {
      return { authUrl: "", stateToken: "", expiresAt: new Date().toISOString() };
    },
    async handleCallback() {
      return { success: false, errorCode: "not_implemented", errorMessage: "Stub: implement in provider" };
    },
    async disconnect() {},
    async refreshAuth() {
      return { success: false, errorCode: "not_implemented" };
    },
    async testConnection() {
      return { success: false, message: "Stub: implement test in provider" };
    },
    async getHealth() {
      return {
        status: "unhealthy",
        dimensions: {},
        lastCheckedAt: new Date().toISOString(),
      };
    },
    async fetchSchema() {
      return { objectTypes: [] };
    },
    async runBackfill() {
      return { jobId: "", status: "queued", error: "Stub: not implemented" };
    },
    async runIncrementalSync() {
      return { jobId: "", status: "queued", error: "Stub: not implemented" };
    },
    async receiveWebhook() {
      return { received: false, processedStatus: "received", error: "Stub: not implemented" };
    },
    async reconcileWebhooks() {
      return { success: false, error: "Stub: not implemented" };
    },
    async executeAction() {
      return { success: false, errorCode: "not_implemented", errorMessage: "Stub: not implemented" };
    },
  };
  return stub as ConnectorRuntime;
}
