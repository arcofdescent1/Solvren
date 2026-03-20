# Solvren — Phase 1: Integration Platform Comprehensive Implementation Guide

## Document purpose

This document is the single-pass product and engineering specification for **Phase 1 — Integration Platform** for Solvren.

Its purpose is to give product, engineering, and design one comprehensive implementation guide that closes the most important gap identified in the current product direction: Solvren must move from “integrations exist” to “integrations are dependable, observable, explainable, and powerful enough to support closed-loop revenue protection.”

This guide assumes Phase 0 has established the platform vocabulary, canonical issue model, lifecycle, module boundaries, and migration strategy. Phase 1 builds the integration foundation required for the Signals Engine, Execution Engine, and later detector/verification work described in the Solvren North Star. Solvren’s guiding loop is to detect issues, quantify impact, prioritize action, route ownership, track resolution, and verify outcomes. The product vision also explicitly requires centralizing signals from key systems, normalizing them, and supporting assignment and workflow execution through integrations such as Jira and Slack. fileciteturn4file0L5-L24 fileciteturn4file0L85-L103 fileciteturn4file2L5-L25

---

# 1. Phase 1 mandate

## 1.1 Business goal

Solvren must become the trusted connection layer between fragmented systems such as CRM, payments, scheduling, marketing, warehouses, and internal tooling so it can surface revenue-impacting failures before they cause loss. The product context already defines that fragmentation leads to duplicate data, broken workflows, revenue leakage, missed follow-up, poor attribution, and invisible failures. fileciteturn4file0L25-L45

Phase 1 exists to make integrations operationally real.

That means Solvren must:

- connect securely to source systems
- maintain healthy authenticated connections
- ingest data and events reliably
- explain what data is available and what is missing
- expose health and trust status to customers
- support outbound actions where appropriate
- log and audit every integration-side operation
- provide a stable platform for later signal normalization and detector work

## 1.2 Product outcome

At the end of Phase 1, a customer should be able to connect a supported system and immediately understand:

- whether the integration is installed
- whether authentication is healthy
- what permissions/scopes are granted
- what objects Solvren can read
- what events Solvren can receive
- what actions Solvren can take
- the freshness of synced data
- the last successful sync
- the last failed sync
- whether the connection is degraded
- what Solvren can detect or automate from that system

## 1.3 Engineering outcome

At the end of Phase 1, every integration must use a common internal contract instead of provider-specific one-off logic spread across pages, services, cron jobs, and API handlers.

The integration platform must provide:

- a common connector manifest
- a common connector runtime
- standard auth lifecycle handling
- health monitoring
- sync orchestration
- webhook intake and replay
- action execution logging
- observability and metrics
- UI state model for the Integration Control Center
- RBAC and audit support
- compatibility with the Phase 0 issue model

---

# 2. Non-goals for Phase 1

The following are explicitly out of scope for this phase:

- full canonical identity graph across systems
- advanced detector logic
- impact model sophistication
- full autonomous remediation
- warehouse-native data modeling
- AI-driven root cause inference
- every long-tail integration being production-deep

Those belong to later phases.

Phase 1 is about making the integration substrate trustworthy.

---

# 3. Guiding product principles

## 3.1 Integrations are not a checkbox

A green “connected” badge is not enough. Solvren must tell the truth about whether a connection is actually usable for business-critical monitoring.

## 3.2 Health is first-class product value

If an integration is broken, stale, under-scoped, or partially installed, Solvren has blind spots. That is itself a business risk and must be surfaced prominently.

## 3.3 Every integration must be explainable

Customers must understand what Solvren is reading, what Solvren can write, and what Solvren cannot guarantee.

## 3.4 Connectors must be modular

The platform will eventually support a marketplace of integrations. That requires a consistent connector contract now. The long-term context explicitly points toward a marketplace of integrations. fileciteturn4file1L59-L67

## 3.5 Revenue-first prioritization

Integrations should be implemented in the order that best serves the most immediate revenue-protection use cases: CRM, payments, and execution tooling first.

---

# 4. Supported provider tiers for Phase 1

## 4.1 Tier 1 providers — must be production-grade in this phase

These providers must be fully integrated into the common platform contract and exposed through the full control center and health model.

- HubSpot
- Salesforce
- Stripe
- Slack
- Jira

## 4.2 Tier 2 providers — platform-compatible but shallower depth

These providers should conform to the same contract, but may ship with reduced depth if necessary.

- GitHub
- NetSuite

## 4.3 Deferred providers

Scheduling, marketing automation, warehouses, and internal tools are core to the North Star, but they can land in later phases once the platform itself is stable. The North Star explicitly calls out scheduling, marketing automation, data warehouses, and internal tools as part of the long-term signal environment. fileciteturn4file0L25-L35

---

# 5. Integration platform architecture

## 5.1 High-level architecture

Phase 1 introduces a dedicated integration platform layer with six core subdomains:

1. **Connector Registry**
   - Defines what connectors exist
   - Exposes manifests and capabilities
   - Provides install metadata to UI and backend

2. **Connection Manager**
   - Handles auth start/callback/refresh/disconnect
   - Stores installation metadata
   - Maintains status state machine

3. **Sync Orchestrator**
   - Runs full backfills, incremental syncs, health probes, and reconcile jobs
   - Tracks sync cursors and results

4. **Webhook Intake Pipeline**
   - Receives provider events
   - Verifies signatures
   - persists raw events
   - schedules normalization and downstream processing

5. **Action Execution Layer**
   - Executes provider-side outbound actions
   - Logs requests, responses, status, and retry information

6. **Integration Control Center**
   - Product surface for connection health, coverage, permissions, and actions
   - The single source of truth in the UI

## 5.2 Required module layout

Implement these folders under `src/modules/integrations/`:

- `src/modules/integrations/core`
- `src/modules/integrations/contracts`
- `src/modules/integrations/registry`
- `src/modules/integrations/auth`
- `src/modules/integrations/health`
- `src/modules/integrations/sync`
- `src/modules/integrations/webhooks`
- `src/modules/integrations/actions`
- `src/modules/integrations/telemetry`
- `src/modules/integrations/ui`
- `src/modules/integrations/providers/hubspot`
- `src/modules/integrations/providers/salesforce`
- `src/modules/integrations/providers/stripe`
- `src/modules/integrations/providers/slack`
- `src/modules/integrations/providers/jira`
- `src/modules/integrations/providers/github`
- `src/modules/integrations/providers/netsuite`

## 5.3 Transitional rule

Existing provider-specific code can continue to exist temporarily, but all new logic must be routed through the Phase 1 contracts. Existing code should be migrated behind the new interfaces instead of expanded in place.

---

# 6. Connector contract

## 6.1 Overview

Every connector must implement two core interfaces:

- `ConnectorManifest`
- `ConnectorRuntime`

The manifest is declarative and powers product surfaces, install flows, permissions explanation, and compatibility checks.

The runtime performs actual work.

## 6.2 ConnectorManifest

Every provider must export a manifest with the following required fields.

```ts
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

export interface ConnectorManifest {
  provider: IntegrationProvider;
  displayName: string;
  category: "crm" | "payments" | "communication" | "work_management" | "engineering" | "erp";
  description: string;
  authType: AuthType;
  supportedSyncModes: SyncMode[];
  capabilities: CapabilityType[];
  supportedObjectTypes: string[];
  supportedInboundEvents: string[];
  supportedOutboundActions: string[];
  requiredScopes: string[];
  optionalScopes: string[];
  installPrerequisites: string[];
  docsUrl?: string;
  iconAssetKey: string;
  healthCheckStrategy: "api_probe" | "token_validation" | "webhook_heartbeat" | "hybrid";
  minimumPlan: "starter" | "growth" | "enterprise";
  isTierOne: boolean;
}
```

## 6.3 ConnectorRuntime

```ts
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
```

## 6.4 Rules for all connector implementations

Every connector must:

- be stateless outside of platform-managed persistence
- never write directly to arbitrary application tables
- produce structured logs
- raise typed errors
- support idempotency where relevant
- be safe for retries
- redact secrets in logs and audit trails
- declare all permissions it requires
- expose provider capability coverage honestly

No connector may skip the manifest or bypass common persistence.

---

# 7. Integration status model

## 7.1 Why a status model matters

A binary “connected/not connected” state is insufficient for enterprise trust.

Solvren must truthfully model operational readiness.

## 7.2 Status states

Use the following status enum for all integration installations:

- `not_installed`
- `installing`
- `connected`
- `connected_limited`
- `degraded`
- `syncing`
- `action_limited`
- `auth_expired`
- `error`
- `disconnected`

## 7.3 Status semantics

### not_installed
No active installation exists.

### installing
OAuth or install flow is in progress but not finalized.

### connected
Authentication healthy, sync healthy, required scopes granted, basic health checks passing.

### connected_limited
Connected, but missing optional scope(s), missing webhook setup, or only partial object coverage available.

### degraded
Connected, but health issues exist: stale syncs, repeated failures, or rate-limit problems.

### syncing
Backfill or reconciliation currently running.

### action_limited
Read-side healthy, but outbound actions are disabled or misconfigured.

### auth_expired
Credentials invalid or refresh failed.

### error
Critical connector failure prevents safe operation.

### disconnected
Installation intentionally removed.

## 7.4 Derived health dimension model

In addition to top-level status, store individual health dimensions:

- auth health
- API reachability
- scope coverage
- webhook health
- sync freshness
- action readiness
- rate-limit pressure
- install completeness

These dimensions allow precise messaging in the UI.

---

# 8. Database schema

## 8.1 Core tables

The following tables must be added in this phase or normalized into these shapes if similar tables already exist.

## 8.2 `integration_accounts`

```sql
create table if not exists integration_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  provider text not null,
  display_name text not null,
  category text not null,
  auth_type text not null,
  status text not null default 'not_installed',
  connection_mode text not null,
  installed_by_user_id uuid references auth.users(id),
  installed_at timestamptz,
  disconnected_at timestamptz,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error_code text,
  last_error_message text,
  health_summary_json jsonb not null default '{}'::jsonb,
  scopes_granted_json jsonb not null default '[]'::jsonb,
  scopes_missing_json jsonb not null default '[]'::jsonb,
  config_json jsonb not null default '{}'::jsonb,
  secrets_ref text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id, provider)
);
```

## 8.3 `integration_auth_sessions`

Tracks in-progress auth handshakes and callback state.

```sql
create table if not exists integration_auth_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  provider text not null,
  initiated_by_user_id uuid not null references auth.users(id),
  state_token text not null unique,
  pkce_verifier text,
  redirect_uri text not null,
  requested_scopes_json jsonb not null default '[]'::jsonb,
  status text not null default 'pending',
  expires_at timestamptz not null,
  callback_received_at timestamptz,
  error_json jsonb,
  created_at timestamptz not null default now()
);
```

## 8.4 `integration_credentials`

Store only encrypted/tokenized values or references to secrets storage.

```sql
create table if not exists integration_credentials (
  id uuid primary key default gen_random_uuid(),
  integration_account_id uuid not null references integration_accounts(id) on delete cascade,
  credential_type text not null,
  secret_ref text not null,
  expires_at timestamptz,
  refreshable boolean not null default false,
  last_refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## 8.5 `integration_sync_jobs`

```sql
create table if not exists integration_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  integration_account_id uuid not null references integration_accounts(id) on delete cascade,
  job_type text not null,
  job_scope text,
  status text not null default 'queued',
  trigger_source text not null,
  cursor_json jsonb not null default '{}'::jsonb,
  request_json jsonb not null default '{}'::jsonb,
  metrics_json jsonb not null default '{}'::jsonb,
  result_json jsonb not null default '{}'::jsonb,
  error_json jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
```

## 8.6 `integration_webhook_endpoints`

```sql
create table if not exists integration_webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  integration_account_id uuid not null references integration_accounts(id) on delete cascade,
  provider text not null,
  endpoint_url text not null,
  external_endpoint_id text,
  signing_secret_ref text,
  health_status text not null default 'unknown',
  last_event_received_at timestamptz,
  last_verification_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## 8.7 `integration_webhook_events`

```sql
create table if not exists integration_webhook_events (
  id uuid primary key default gen_random_uuid(),
  integration_account_id uuid references integration_accounts(id) on delete cascade,
  provider text not null,
  external_event_id text,
  event_type text not null,
  request_headers_json jsonb not null default '{}'::jsonb,
  payload_json jsonb not null,
  signature_valid boolean,
  received_at timestamptz not null default now(),
  processed_status text not null default 'received',
  processed_at timestamptz,
  processing_error_json jsonb,
  dedupe_key text,
  unique(provider, dedupe_key)
);
```

## 8.8 `integration_action_logs`

```sql
create table if not exists integration_action_logs (
  id uuid primary key default gen_random_uuid(),
  integration_account_id uuid not null references integration_accounts(id) on delete cascade,
  provider text not null,
  issue_id uuid,
  action_type text not null,
  target_ref_json jsonb not null default '{}'::jsonb,
  request_json jsonb not null default '{}'::jsonb,
  response_json jsonb not null default '{}'::jsonb,
  status text not null,
  retry_count int not null default 0,
  executed_by_user_id uuid references auth.users(id),
  executed_at timestamptz,
  created_at timestamptz not null default now()
);
```

## 8.9 `integration_health_checks`

```sql
create table if not exists integration_health_checks (
  id uuid primary key default gen_random_uuid(),
  integration_account_id uuid not null references integration_accounts(id) on delete cascade,
  provider text not null,
  check_type text not null,
  status text not null,
  summary text,
  details_json jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);
```

## 8.10 `integration_supported_objects`

This table lets the UI describe installed coverage by provider.

```sql
create table if not exists integration_supported_objects (
  id uuid primary key default gen_random_uuid(),
  integration_account_id uuid not null references integration_accounts(id) on delete cascade,
  object_type text not null,
  read_enabled boolean not null default false,
  write_enabled boolean not null default false,
  event_enabled boolean not null default false,
  backfill_complete boolean not null default false,
  last_synced_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb
);
```

## 8.11 `integration_provider_actions`

```sql
create table if not exists integration_provider_actions (
  id uuid primary key default gen_random_uuid(),
  integration_account_id uuid not null references integration_accounts(id) on delete cascade,
  action_key text not null,
  enabled boolean not null default false,
  config_json jsonb not null default '{}'::jsonb,
  last_tested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(integration_account_id, action_key)
);
```

## 8.12 Search and indexes

Add indexes on:

- `(org_id, provider)` for `integration_accounts`
- `(integration_account_id, status)` for sync jobs
- `(provider, dedupe_key)` for webhook events
- `(integration_account_id, checked_at desc)` for health checks
- `(integration_account_id, action_type, created_at desc)` for action logs

## 8.13 RLS and tenancy

Every integration table must be org-scoped and protected by row-level security consistent with the existing org membership and RBAC patterns.

Only authorized org admins and permitted operators should be able to install/disconnect integrations or view credentials metadata.

---

# 9. Auth and credential management

## 9.1 Security requirements

Integration credentials are high-risk assets and must never be stored or logged in plaintext.

## 9.2 Credential storage rules

Use one of the following patterns:

- secret reference stored in DB, actual token in secret manager
- encrypted token in DB if required by current infra, with rotation support and strict service-layer access
- signing secrets and refresh tokens must use the same secret policy

## 9.3 Required auth flow support

### OAuth2 connectors
Must support:

- state token verification
- PKCE where available
- secure callback handling
- token refresh
- disconnect/revoke where API permits

### API key connectors
Must support:

- secret validation test
- scope/capability check if provider supports it
- rotation flow

### Service-account or custom connectors
Must support:

- admin-only configuration
- health probe verification
- explicit environment separation

## 9.4 Environment isolation

Each integration installation must be tagged as one of:

- production
- sandbox
- test
- development

No production org may silently use a sandbox integration unless explicitly configured and labeled in UI.

---

# 10. Sync orchestration

## 10.1 Sync job types

Every provider may support some or all of the following standardized job types:

- `initial_backfill`
- `incremental_sync`
- `webhook_reconcile`
- `health_probe`
- `schema_discovery`
- `action_capability_test`
- `cursor_repair`

## 10.2 Required sync orchestration behavior

The sync orchestrator must support:

- queued execution
- concurrency limits per provider and per org
- rate-limit-aware backoff
- resumable cursor-based jobs
- idempotent replays
- dead-letter handling
- observable job metrics
- manual re-run from UI where safe

## 10.3 Freshness SLAs

Every integration must have a freshness expectation by sync mode.

Examples:
- webhook-enabled CRM events: near-real-time, target under 5 minutes
- polling incremental sync: target under 15–60 minutes
- daily backfill or reconciliation jobs: target under 24 hours

Freshness thresholds must drive degraded status if breached.

## 10.4 Sync cursor model

Store provider cursors in structured JSON with versioning. Do not store opaque arbitrary values with no version metadata.

Example:

```json
{
  "version": 1,
  "object": "deal",
  "cursorType": "updatedAt",
  "value": "2026-03-19T12:00:00Z"
}
```

## 10.5 Backfill expectations

Tier 1 connectors must support an initial backfill covering the core object set needed for upcoming detector work.

Backfill should not be all-or-nothing. Partial object coverage should be tracked and surfaced.

---

# 11. Webhook intake and replay

## 11.1 Why this matters

Webhooks are the fastest and most reliable path to real-time signals, but they fail silently if not treated as a product surface.

## 11.2 Required pipeline behavior

Every webhook-enabled connector must support:

- request receipt
- signature validation
- dedupe
- raw event persistence
- processing status transitions
- replay/reprocess
- stale-heartbeat detection

## 11.3 Standard processing statuses

- `received`
- `validated`
- `queued`
- `processed`
- `duplicate`
- `discarded`
- `failed`

## 11.4 Replay tooling

The Integration Control Center must allow authorized operators to:

- view recent webhook events
- inspect failures
- retry failed processing
- replay by event ID
- trigger a reconcile job if the provider supports missed-event recovery

## 11.5 Heartbeat logic

If a webhook-based integration is expected to generate steady traffic but no events arrive within a defined window, the integration may move to `degraded` if this suggests a broken webhook configuration or upstream outage.

---

# 12. Action execution layer

## 12.1 Purpose

The product context makes clear that integrations like Jira and Slack are not just data sources; they are part of routing and execution. Solvren’s ownership and workflow tracking depend on these action paths. fileciteturn4file2L15-L28

## 12.2 Phase 1 allowed outbound actions

Phase 1 should support a limited but solid set of safe write-backs.

### Slack
- post message
- post issue summary to channel
- create or continue thread
- post alert with action links

### Jira
- create issue
- update issue status
- add comment
- attach issue link to Solvren issue

### HubSpot
- create task
- assign owner
- add note
- associate note/task to contact/company/deal where supported

### Salesforce
- create task
- update owner on supported objects
- add comment/note equivalent if available

### Stripe
Phase 1 should be mostly read-focused.
Only allow extremely safe actions if implemented, such as creating an internal note/log reference, not mutating sensitive financial records.

### GitHub / NetSuite
Only shallow actions if already supported reliably in current codebase. Otherwise defer.

## 12.3 Action execution rules

Every outbound action must:

- require explicit capability declaration in connector manifest
- validate target object shape before execution
- produce an action log
- return a structured success/failure result
- capture provider identifiers for created artifacts
- support retry only where idempotency is safe

## 12.4 Action approval rules

Certain actions should require elevated role permissions or explicit confirmation modals.

Examples:
- disconnect integration
- change provider configuration
- create broad Jira project issue using production template
- reassign CRM owner en masse

---

# 13. Integration Control Center — product specification

## 13.1 Page purpose

The Integration Control Center is the main Phase 1 product surface. It must become the authoritative place where a customer understands what Solvren is connected to, how healthy those connections are, and what business value those integrations unlock.

## 13.2 Navigation

Add a top-level application area:

- `Settings > Integrations`

Optional secondary exec view:
- `Admin > Integration Health`

## 13.3 Main list page

The main Integrations page must show one card or table row per provider with:

- provider icon and name
- category
- status badge
- environment tag
- last success timestamp
- last error timestamp
- object coverage summary
- read/event/action capabilities summary
- freshness indicator
- quick actions:
  - connect / reconnect
  - test connection
  - open details
  - disconnect
  - run sync

## 13.4 Detail page sections

Each provider detail page must include:

### Header
- provider name
- status
- environment
- connection owner
- installed at
- last health check
- reconnect/test/disconnect actions

### Setup completeness
- install prerequisites checklist
- callback/webhook setup status
- scope completeness
- required config completeness

### Permissions and scopes
- required scopes
- granted scopes
- missing scopes
- explanation of why Solvren needs each scope

### Object coverage
For each supported object:
- can read
- receives events
- can write actions
- last sync
- backfill complete
- notes on limitations

### Health
- auth health
- sync freshness
- webhook health
- API reachability
- rate-limit pressure
- action readiness
- health history timeline

### Activity
- recent sync jobs
- recent webhook events
- recent action logs
- recent errors

### Business value panel
Show:
- detector packs unlocked
- actions enabled
- data sources available for future issue detection
- any blind spots due to incomplete setup

## 13.5 Install flow UX

The install flow must be more than a redirect to OAuth.

Flow:
1. select provider
2. explain business value
3. explain required permissions
4. choose environment if relevant
5. begin auth
6. return to callback completion page
7. run connection test
8. optionally run initial backfill
9. show post-install state and next recommended actions

## 13.6 Error UX

Every failure state must show:

- what failed
- impact on coverage
- whether Solvren is blind to data or actions
- what the user can do next
- retry CTA
- support CTA for unresolvable failures

---

# 14. Provider-by-provider implementation notes

## 14.1 HubSpot

### Minimum required object coverage
- contacts
- companies
- deals
- owners
- tasks if action support used
- engagements/notes if available

### Minimum required capabilities
- OAuth install
- API test
- incremental sync
- webhook support if available and stable
- create task
- assign owner
- add note

### Health dimensions
- auth
- contact sync freshness
- deal sync freshness
- webhook status
- action readiness

### Known business value messaging
- lead routing
- deal hygiene
- attribution confidence
- follow-up gap detection

## 14.2 Salesforce

### Minimum required object coverage
- leads
- contacts
- accounts
- opportunities
- users/owners
- tasks

### Minimum required capabilities
- OAuth install
- API test
- object schema discovery where possible
- incremental sync
- task creation
- owner update where safely supported

### Health dimensions
- auth
- API quota/rate pressure
- object sync freshness
- action readiness

## 14.3 Stripe

### Minimum required object coverage
- customers
- subscriptions
- invoices
- payment intents/charges
- disputes if easy to support

### Minimum required capabilities
- API key or OAuth depending chosen model
- webhook receipt
- read-side backfill
- incremental sync
- health test for API reachability and webhook setup

### Product note
Stripe is revenue-critical. Even if write-backs remain limited, health and freshness must be excellent.

## 14.4 Slack

### Minimum required capabilities
- OAuth install
- bot token validation
- post message
- thread support
- channel selection/config
- action telemetry for Slack-originated interactions if already present

### Health dimensions
- auth
- channel accessibility
- posting test success
- user mapping completeness if used

## 14.5 Jira

### Minimum required capabilities
- OAuth or API-token auth depending implementation
- project configuration
- create issue
- update issue
- comment
- installation health and field-config validation

### Health dimensions
- auth
- project accessibility
- create-issue readiness
- field mapping readiness

## 14.6 GitHub and NetSuite

Support manifest, connection metadata, health checks, and minimal capability surfacing. Do not block Phase 1 completion on deep product workflows here.

---

# 15. API contract

## 15.1 REST route map

Use a consistent route namespace under `/api/integrations`.

### Provider registry
- `GET /api/integrations/providers`
- `GET /api/integrations/providers/:provider`

### Account status
- `GET /api/integrations/:provider/status`
- `GET /api/integrations/:provider/details`

### Auth flow
- `POST /api/integrations/:provider/connect/start`
- `GET /api/integrations/:provider/connect/callback`
- `POST /api/integrations/:provider/disconnect`
- `POST /api/integrations/:provider/refresh`

### Health and sync
- `POST /api/integrations/:provider/test`
- `POST /api/integrations/:provider/sync`
- `GET /api/integrations/:provider/sync-jobs`
- `GET /api/integrations/:provider/health`
- `POST /api/integrations/:provider/reconcile`

### Schema and coverage
- `GET /api/integrations/:provider/schema`
- `GET /api/integrations/:provider/object-coverage`
- `GET /api/integrations/:provider/actions`

### Webhooks
- `POST /api/integrations/:provider/webhook`
- `POST /api/integrations/:provider/webhook/replay`

### Action execution
- `POST /api/integrations/:provider/actions/:actionKey`

## 15.2 Response envelope standard

Use a consistent response shape:

```ts
interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId?: string;
    timestamp: string;
  };
}
```

## 15.3 Example status response

```json
{
  "ok": true,
  "data": {
    "provider": "hubspot",
    "status": "connected_limited",
    "environment": "production",
    "installedAt": "2026-03-19T14:00:00Z",
    "lastSuccessAt": "2026-03-19T14:12:00Z",
    "lastErrorAt": null,
    "health": {
      "auth": "healthy",
      "syncFreshness": "healthy",
      "webhooks": "degraded",
      "actions": "healthy"
    },
    "scopeCoverage": {
      "requiredGranted": 5,
      "requiredMissing": 0,
      "optionalGranted": 2,
      "optionalMissing": 1
    },
    "objectCoverage": [
      {
        "objectType": "contact",
        "readEnabled": true,
        "eventEnabled": true,
        "writeEnabled": false,
        "lastSyncedAt": "2026-03-19T14:12:00Z",
        "backfillComplete": true
      }
    ]
  },
  "meta": {
    "timestamp": "2026-03-19T14:13:00Z"
  }
}
```

---

# 16. Background jobs and schedulers

## 16.1 Required scheduled jobs

Phase 1 requires recurring jobs for:

- connection health checks
- sync freshness evaluation
- stale webhook detection
- auth refresh attempts
- retry queues for safe failed actions
- stale install cleanup for abandoned auth sessions

## 16.2 Frequency recommendations

### Health checks
Every 15 minutes for Tier 1 integrations.

### Sync freshness evaluation
Every 10 minutes.

### Webhook heartbeat evaluation
Every 30 minutes.

### Auth refresh
Triggered near expiry and opportunistically on failures.

### Retry queue
Every 5 minutes with capped exponential backoff.

---

# 17. RBAC and permissions

## 17.1 Required product roles for integration management

At minimum, support the following action permissions:

- view integration status
- install integration
- disconnect integration
- run sync/reconcile
- view webhook payloads
- execute outbound actions
- edit provider config
- view credential metadata

## 17.2 Suggested role mapping

### Org Admin
Full control.

### Ops Admin / Platform Admin
Install, disconnect, run sync, view health, view logs, execute allowed actions.

### Department Lead
View status and business value, but cannot install/disconnect unless granted.

### Analyst / Viewer
Read-only visibility into health and coverage.

## 17.3 Sensitive payload access

Webhook payload bodies and provider responses may include sensitive customer or revenue data. Access to raw payload inspection should be restricted to admin/operator roles and logged.

---

# 18. Audit, observability, and telemetry

## 18.1 Audit log requirements

Every material integration event must write an audit log entry:

- install initiated
- callback completed
- scopes changed
- disconnect
- test connection run
- sync started/completed/failed
- webhook replayed
- action executed
- credentials refreshed
- provider config edited

## 18.2 Metrics

Emit operational metrics by provider and org:

- install success rate
- auth refresh success rate
- sync success rate
- sync lag
- webhook success rate
- webhook duplicate rate
- action success rate
- rate-limit incidence
- degraded hours by provider
- average time to recovery

## 18.3 Structured logs

All logs must include:

- org_id
- provider
- integration_account_id
- operation
- request_id / trace_id
- result status
- error code if failed

## 18.4 Product analytics

Track product usage events such as:

- integration details page viewed
- install flow started/completed
- health warning banner viewed
- test connection clicked
- manual sync clicked
- action executed from issue page

These will later inform onboarding and pricing analysis.

---

# 19. Migration strategy

## 19.1 Migration philosophy

Do not break existing integrations already in the repo. Wrap and migrate them.

## 19.2 Sequence

### Step 1
Add Phase 1 tables and RLS.

### Step 2
Create connector manifest registry and runtime interfaces.

### Step 3
Build Connection Manager service layer.

### Step 4
Refactor existing provider implementations to conform to runtime interface.

### Step 5
Implement Integration Control Center read-side pages using existing integration data where possible.

### Step 6
Migrate install flows to new auth session tracking.

### Step 7
Migrate sync jobs and webhook storage into standardized tables.

### Step 8
Migrate action execution to standardized action logs.

### Step 9
Turn on health state derivation and top-level status model.

## 19.3 Backfill of current integration records

If existing provider-specific tables already contain install records, write a one-time migration script that:

- creates `integration_accounts`
- maps old provider data into account rows
- maps existing webhook configs and tokens where safe
- marks confidence/limitations if legacy data incomplete
- creates initial health check entries
- preserves old IDs inside metadata for traceability

---

# 20. File-by-file implementation plan

## 20.1 Core contracts

Create:

- `src/modules/integrations/contracts/types.ts`
- `src/modules/integrations/contracts/manifest.ts`
- `src/modules/integrations/contracts/runtime.ts`
- `src/modules/integrations/contracts/errors.ts`

## 20.2 Registry

Create:

- `src/modules/integrations/registry/providerRegistry.ts`
- `src/modules/integrations/registry/getProviderManifest.ts`

## 20.3 Persistence repositories

Create:

- `src/modules/integrations/core/integrationAccountsRepo.ts`
- `src/modules/integrations/core/integrationCredentialsRepo.ts`
- `src/modules/integrations/core/integrationSyncJobsRepo.ts`
- `src/modules/integrations/core/integrationWebhookRepo.ts`
- `src/modules/integrations/core/integrationActionLogsRepo.ts`
- `src/modules/integrations/core/integrationHealthRepo.ts`

## 20.4 Services

Create:

- `src/modules/integrations/auth/connectionManager.ts`
- `src/modules/integrations/health/healthEvaluator.ts`
- `src/modules/integrations/sync/syncOrchestrator.ts`
- `src/modules/integrations/webhooks/webhookIngestionService.ts`
- `src/modules/integrations/actions/actionExecutionService.ts`
- `src/modules/integrations/telemetry/integrationMetrics.ts`

## 20.5 Provider adapters

Per provider:

- `src/modules/integrations/providers/hubspot/manifest.ts`
- `src/modules/integrations/providers/hubspot/runtime.ts`

Repeat for each provider.

## 20.6 UI pages

Create or refactor:

- `src/app/(app)/settings/integrations/page.tsx`
- `src/app/(app)/settings/integrations/[provider]/page.tsx`
- `src/app/api/integrations/providers/route.ts`
- `src/app/api/integrations/[provider]/status/route.ts`
- `src/app/api/integrations/[provider]/connect/start/route.ts`
- `src/app/api/integrations/[provider]/connect/callback/route.ts`
- `src/app/api/integrations/[provider]/test/route.ts`
- `src/app/api/integrations/[provider]/sync/route.ts`
- `src/app/api/integrations/[provider]/actions/[actionKey]/route.ts`
- `src/app/api/integrations/[provider]/webhook/route.ts`

## 20.7 UI components

Create:

- `src/components/integrations/IntegrationControlCenter.tsx`
- `src/components/integrations/IntegrationProviderCard.tsx`
- `src/components/integrations/IntegrationHealthBadge.tsx`
- `src/components/integrations/IntegrationPermissionsPanel.tsx`
- `src/components/integrations/IntegrationObjectCoverageTable.tsx`
- `src/components/integrations/IntegrationActivityFeed.tsx`
- `src/components/integrations/IntegrationHealthTimeline.tsx`
- `src/components/integrations/IntegrationInstallFlow.tsx`
- `src/components/integrations/IntegrationBusinessValuePanel.tsx`

---

# 21. State derivation logic

## 21.1 Health-to-status resolver

Top-level status should be derived using deterministic rules.

Example precedence:

1. if disconnected flag set → `disconnected`
2. if auth invalid/expired → `auth_expired`
3. if install incomplete → `installing`
4. if critical error active → `error`
5. if sync currently running → `syncing`
6. if read healthy but action config invalid → `action_limited`
7. if required scopes missing or webhook/config incomplete → `connected_limited`
8. if freshness or health dimensions failing → `degraded`
9. else → `connected`

## 21.2 Blind spot logic

An integration must expose blind spots to the customer.

Examples:
- “Connected, but webhook events are not enabled. New records may be delayed up to 30 minutes.”
- “Connected, but task-write capability is unavailable due to missing scope.”
- “Connected, but only contacts are synced; deals are not yet available for detection.”

This logic should be generated from manifest + granted scopes + object coverage + health dimensions.

---

# 22. Product copy requirements

## 22.1 Integration value language

Every integration must communicate customer value in business terms, not just technical terms.

Examples:
- HubSpot: “Monitor lead ownership, follow-up gaps, and deal hygiene.”
- Salesforce: “Protect pipeline continuity and opportunity progression.”
- Stripe: “Identify failed payment patterns and at-risk subscription revenue.”
- Slack: “Route issues quickly to the teams who can fix them.”
- Jira: “Track remediation work through engineering workflows.”

## 22.2 Warning language

Use precise, low-drama wording:
- “Degraded”
- “Limited coverage”
- “Auth expired”
- “Webhook events missing”
- “Sync stale”
- “Actions unavailable”

Avoid vague messages such as “Something went wrong.”

---

# 23. Testing strategy

## 23.1 Unit tests

Required for:
- manifest validation
- health evaluation rules
- status derivation
- auth callback handling
- sync cursor logic
- action request validation
- webhook signature verification
- dedupe logic

## 23.2 Integration tests

Required for:
- install flow start/callback
- health test execution
- sync job lifecycle
- webhook receipt and replay
- action execution logging
- RLS enforcement on org data

## 23.3 Provider contract tests

Each provider runtime must pass a contract suite verifying that required runtime methods behave consistently.

## 23.4 UI tests

Required scenarios:
- integrations list renders all providers
- connected_limited surfaces clear setup guidance
- degraded state displays health reasons
- test connection flow works
- run sync flow works
- disconnect flow requires confirmation
- detail page shows object coverage and recent activity

## 23.5 Failure-mode tests

Explicitly test:
- token expiry
- refresh failure
- provider rate limit
- webhook signature mismatch
- duplicate webhooks
- partial backfill
- action failure and retry
- missing scopes after provider-side permission changes

---

# 24. Acceptance criteria

Phase 1 is complete only if all of the following are true.

## 24.1 Product acceptance

- Customers can install Tier 1 integrations through a guided flow.
- Every installed integration shows truthful health and coverage.
- The Integration Control Center clearly explains value, limitations, and next steps.
- Degraded or limited integrations are visible and actionable.
- Integration detail pages expose permissions, sync freshness, and activity.

## 24.2 Engineering acceptance

- All Tier 1 integrations conform to the common manifest/runtime contract.
- Standardized persistence exists for accounts, sync jobs, webhooks, actions, and health checks.
- Health status is derived consistently across providers.
- Webhook events are persisted and replayable.
- Outbound actions are logged consistently.
- Secrets are not stored or logged insecurely.
- RLS is enforced on all integration data.

## 24.3 Operational acceptance

- Support can diagnose integration failures from logs and UI.
- Product can measure install success, sync health, and action success rates.
- The platform can identify blind spots caused by stale or limited integrations.
- Existing integrations in the codebase continue to function or are migrated with no customer data loss.

---

# 25. Definition of done for moving to Phase 2

Phase 1 is done when Solvren has a dependable integration substrate on which identity stitching and signal normalization can be built.

Specifically, before beginning Phase 2:

- Tier 1 providers are standardized
- install/auth/health/sync/action models are unified
- integration status is truthful and observable
- customers can see data coverage and blind spots
- the system can safely persist and replay provider events
- later phases can consume provider data from standardized interfaces instead of provider-specific spaghetti

When those conditions are met, Solvren is ready for **Phase 2 — Canonical Data Model and Identity Graph**.

---

# 26. Recommended implementation order

## Sprint A
- schema migrations
- contracts
- registry
- status model
- health evaluator

## Sprint B
- auth session manager
- integration accounts persistence
- Tier 1 provider manifests
- list page and detail page skeletons

## Sprint C
- provider runtimes for HubSpot, Salesforce, Stripe
- sync orchestration
- health checks
- object coverage table

## Sprint D
- provider runtimes for Slack and Jira
- action execution layer
- activity feeds and action logs

## Sprint E
- webhook standardization
- replay tools
- failure handling
- degraded/blind-spot UX polish

## Sprint F
- migration of legacy provider flows
- analytics/telemetry
- test hardening
- launch checklist

---

# 27. Launch checklist

Before shipping Phase 1 to customers:

- complete security review for token handling
- verify callback URLs per environment
- confirm audit logging for all critical operations
- test install + disconnect + reconnect across Tier 1 providers
- validate degraded-state UX with intentionally broken connections
- validate support runbook for common failures
- confirm product documentation and setup help content
- ensure feature flags available for controlled rollout

---

# 28. Final implementation instruction

The integration platform is not an admin accessory. It is one of Solvren’s product cores.

If Solvren’s value proposition is to protect revenue by detecting, routing, and verifying cross-system issues, then Phase 1 must make integrations trustworthy enough that customers, operators, and downstream detectors can rely on them.

Do not optimize this phase for superficial breadth. Optimize it for durable trust, clear coverage, and excellent Tier 1 execution.

That is what will allow later phases to build a real Signals Engine, a real Detection Engine, and a real closed-loop operational risk platform. fileciteturn4file0L46-L83 fileciteturn4file1L1-L19
