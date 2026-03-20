/**
 * Phase 1 — ConnectorRuntime and I/O types (§6.3).
 * All connectors implement this interface.
 */

import type { IntegrationProvider } from "./types";

export interface ConnectStartInput {
  orgId: string;
  userId: string;
  redirectUri: string;
  stateToken: string;
  pkceVerifier?: string;
  requestedScopes?: string[];
  environment?: string;
}

export interface ConnectStartResult {
  authUrl: string;
  stateToken: string;
  expiresAt: string;
}

export interface ConnectCallbackInput {
  orgId: string;
  provider: IntegrationProvider;
  stateToken: string;
  code?: string;
  error?: string;
  errorDescription?: string;
}

export interface ConnectCallbackResult {
  success: boolean;
  integrationAccountId?: string;
  /** For persistence layer: create integration_account if not returned */
  displayName?: string;
  scopesGranted?: string[];
  scopesMissing?: string[];
  config?: Record<string, unknown>;
  tokenRef?: string;
  tokenExpiresAt?: string;
  refreshable?: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export interface DisconnectInput {
  orgId: string;
  integrationAccountId: string;
  userId: string;
}

export interface RefreshAuthInput {
  orgId: string;
  integrationAccountId: string;
}

export interface RefreshAuthResult {
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export interface TestConnectionInput {
  orgId: string;
  integrationAccountId: string;
}

export interface TestConnectionResult {
  success: boolean;
  message?: string;
  details?: Record<string, unknown>;
}

export interface IntegrationHealthReport {
  status: "healthy" | "degraded" | "unhealthy";
  dimensions: Record<string, "healthy" | "degraded" | "unhealthy" | "unknown">;
  summary?: string;
  lastCheckedAt: string;
}

export interface GetHealthInput {
  orgId: string;
  integrationAccountId: string;
}

export interface FetchSchemaInput {
  orgId: string;
  integrationAccountId: string;
}

export interface ProviderSchemaResult {
  objectTypes: { key: string; label: string; syncable: boolean }[];
  error?: string;
}

export interface RunBackfillInput {
  orgId: string;
  integrationAccountId: string;
  objectTypes?: string[];
  triggerSource: string;
}

export interface BackfillResult {
  jobId: string;
  status: "queued" | "running";
  error?: string;
}

export interface RunIncrementalSyncInput {
  orgId: string;
  integrationAccountId: string;
  cursor?: Record<string, unknown>;
  triggerSource: string;
}

export interface IncrementalSyncResult {
  jobId: string;
  status: "queued" | "running";
  nextCursor?: Record<string, unknown>;
  error?: string;
}

export interface ReceiveWebhookInput {
  provider: IntegrationProvider;
  integrationAccountId?: string | null;
  headers: Record<string, string>;
  payload: unknown;
  rawBody?: string;
}

export interface WebhookReceiptResult {
  received: boolean;
  eventId?: string;
  processedStatus: string;
  error?: string;
}

export interface ReconcileWebhookInput {
  orgId: string;
  integrationAccountId: string;
}

export interface ReconcileWebhookResult {
  success: boolean;
  eventsProcessed?: number;
  error?: string;
}

export interface ExecuteActionInput {
  orgId: string;
  integrationAccountId: string;
  actionKey: string;
  params: Record<string, unknown>;
  issueId?: string | null;
  userId?: string | null;
}

export interface ActionExecutionResult {
  success: boolean;
  externalId?: string;
  message?: string;
  errorCode?: string;
  errorMessage?: string;
}

/** §6.3 ConnectorRuntime — every provider implements this */
export interface ConnectorRuntime {
  connect(input: ConnectStartInput): Promise<ConnectStartResult>;
  handleCallback(input: ConnectCallbackInput): Promise<ConnectCallbackResult>;
  disconnect(input: DisconnectInput): Promise<void>;
  refreshAuth(input: RefreshAuthInput): Promise<RefreshAuthResult>;
  testConnection(input: TestConnectionInput): Promise<TestConnectionResult>;
  getHealth(input: GetHealthInput): Promise<IntegrationHealthReport>;
  fetchSchema(input: FetchSchemaInput): Promise<ProviderSchemaResult>;
  runBackfill(input: RunBackfillInput): Promise<BackfillResult>;
  runIncrementalSync(input: RunIncrementalSyncInput): Promise<IncrementalSyncResult>;
  receiveWebhook(input: ReceiveWebhookInput): Promise<WebhookReceiptResult>;
  reconcileWebhooks(input: ReconcileWebhookInput): Promise<ReconcileWebhookResult>;
  executeAction(input: ExecuteActionInput): Promise<ActionExecutionResult>;
}
