export * from "./contracts";
export type { ConnectionStatus, HealthStatus, IntegrationCapability, TestCheck, ProviderDiagnostics } from "./types";
export * from "./IntegrationRegistry";
export * from "./IntegrationConnectionService";
export * from "./IntegrationHealthService";
export * from "./IntegrationRetryService";

/** Phase 1 — Integration platform */
export * from "./registry";
export * from "./core";
export { deriveIntegrationStatus } from "./health/healthEvaluator";
export { startConnect, handleCallback, disconnectIntegration } from "./auth/connectionManager";
export { queueBackfill, queueIncrementalSync, completeSyncJob } from "./sync/syncOrchestrator";
export { ingestWebhook } from "./webhooks/webhookIngestionService";
export { executeAction } from "./actions/actionExecutionService";
export { emitIntegrationMetric, logIntegrationOperation } from "./telemetry/integrationMetrics";
