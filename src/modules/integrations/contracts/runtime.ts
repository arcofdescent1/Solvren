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
  /** Object type -> fields for mapping UI (Phase 2) */
  objectFields?: Record<string, Array<{ path: string; type: string; label?: string }>>;
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

/** Phase 3 — Source preview (CSV/DB/warehouse) */
export interface PreviewSourceDataInput {
  orgId: string;
  integrationAccountId: string;
  sourceObjectType?: string;
  limit?: number;
  config?: Record<string, unknown>;
}

export interface ColumnMeta {
  name: string;
  type: string;
  nullable?: boolean;
}

export interface PreviewSourceDataResult {
  rows: unknown[];
  columns?: ColumnMeta[];
  error?: string;
}

/** Phase 3 — Cursor checkpoint retrieval */
export interface GetCheckpointInput {
  orgId: string;
  integrationAccountId: string;
  sourceObjectType: string;
}

export interface GetCheckpointResult {
  checkpoint?: Record<string, unknown>;
  error?: string;
}

/** Phase 3 — Replay support */
export interface ReplayEventsInput {
  orgId: string;
  integrationAccountId: string;
  scopeType: "record" | "job" | "time_range" | "full_source";
  scopeJson: Record<string, unknown>;
  safeReprocess?: boolean;
}

export interface ReplayEventsResult {
  replayJobId: string;
  status: "queued" | "running";
  error?: string;
}

/** Phase 3 — Source metadata (schema discovery) */
export interface FetchSourceMetadataInput {
  orgId: string;
  integrationAccountId: string;
  sourceObjectType?: string;
}

export interface FetchSourceMetadataResult {
  objectTypes?: { key: string; label: string }[];
  columns?: { name: string; type: string }[];
  primaryKeyCandidates?: string[];
  updatedAtCandidates?: string[];
  error?: string;
}

/** §6.3 ConnectorRuntime — every provider implements this. Phase 3 methods are optional. */
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

  /** Phase 3 — Optional: preview source data (CSV/DB/warehouse) */
  previewSourceData?(input: PreviewSourceDataInput): Promise<PreviewSourceDataResult>;
  /** Phase 3 — Optional: get checkpoint for incremental sync */
  getCheckpoint?(input: GetCheckpointInput): Promise<GetCheckpointResult>;
  /** Phase 3 — Optional: replay events */
  replayEvents?(input: ReplayEventsInput): Promise<ReplayEventsResult>;
  /** Phase 3 — Optional: extended source metadata */
  fetchSourceMetadata?(input: FetchSourceMetadataInput): Promise<FetchSourceMetadataResult>;
}
