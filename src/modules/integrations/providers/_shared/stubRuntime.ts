/**
 * Phase 1 — Stub ConnectorRuntime for providers not yet migrated.
 * Implements contract; all operations return minimal success or throw.
 *
 * Phase 2 compatibility: Jira and NetSuite use stub runtimes. The orchestrator and
 * generic routes ([provider]/test, [provider]/health, etc.) are compatible — they
 * delegate to the registry and receive safe stub responses. No full migration required
 * for Phase 2; Jira/NetSuite continue to use their bespoke routes (config, oauth, etc.).
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
