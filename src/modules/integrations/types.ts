/**
 * Canonical integration state model (Phase 2).
 * Connection status = lifecycle/setup state.
 * Health status = runtime operational state.
 */

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "configured"
  | "error";

export type HealthStatus = "healthy" | "degraded" | "error";

export type IntegrationProvider =
  | "jira"
  | "github"
  | "slack"
  | "hubspot"
  | "netsuite"
  | "salesforce"
  | "stripe"
  | "csv"
  | "postgres_readonly"
  | "mysql_readonly"
  | "snowflake"
  | "bigquery";

export type IntegrationCapability = {
  provider: IntegrationProvider;
  supportsOauth?: boolean;
  supportsWebhooks?: boolean;
  supportsValidation?: boolean;
  supportsRetry?: boolean;
  supportsHealthCheck?: boolean;
  supportsManualTest?: boolean;
  supportsDisconnect?: boolean;
  supportsComments?: boolean;
  supportsStatusSync?: boolean;
};

export type TestCheck = {
  name: string;
  status: "ok" | "warning" | "error";
  message?: string;
};

export type ProviderDiagnostics = {
  provider: IntegrationProvider;
  connectionStatus: ConnectionStatus;
  healthStatus: HealthStatus | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  failedCount: number;
  warningCount: number;
  capabilities: Partial<IntegrationCapability>;
  checks: TestCheck[];
  metadata?: Record<string, unknown>;
};
