/**
 * Phase 1 — Integration platform shared types (§6, §7).
 */

export type IntegrationProvider =
  | "hubspot"
  | "salesforce"
  | "stripe"
  | "slack"
  | "jira"
  | "github"
  | "netsuite";

export type AuthType =
  | "oauth2"
  | "api_key"
  | "basic"
  | "service_account"
  | "custom";

export type SyncMode =
  | "polling"
  | "webhook"
  | "hybrid"
  | "manual";

export type CapabilityType =
  | "read_objects"
  | "receive_events"
  | "execute_actions"
  | "health_checks"
  | "schema_discovery"
  | "backfill"
  | "incremental_sync";

/** §7.2 Status states for integration installations */
export type IntegrationAccountStatus =
  | "not_installed"
  | "installing"
  | "connected"
  | "connected_limited"
  | "degraded"
  | "syncing"
  | "action_limited"
  | "auth_expired"
  | "error"
  | "disconnected";

/** §7.4 Health dimensions */
export type HealthDimension =
  | "auth"
  | "api_reachability"
  | "scope_coverage"
  | "webhook_health"
  | "sync_freshness"
  | "action_readiness"
  | "rate_limit_pressure"
  | "install_completeness";

export type HealthDimensionStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

export type IntegrationCategory =
  | "crm"
  | "payments"
  | "communication"
  | "work_management"
  | "engineering"
  | "erp";

export type HealthCheckStrategy =
  | "api_probe"
  | "token_validation"
  | "webhook_heartbeat"
  | "hybrid";

export type MinimumPlan = "starter" | "growth" | "enterprise";

export type WebhookProcessedStatus =
  | "received"
  | "validated"
  | "queued"
  | "processed"
  | "duplicate"
  | "discarded"
  | "failed";

export type SyncJobType =
  | "initial_backfill"
  | "incremental_sync"
  | "webhook_reconcile"
  | "health_probe"
  | "schema_discovery"
  | "action_capability_test"
  | "cursor_repair";

export type SyncJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type EnvironmentTag = "production" | "sandbox" | "test" | "development";
