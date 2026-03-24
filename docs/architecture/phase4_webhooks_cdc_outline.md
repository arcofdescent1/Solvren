# Phase 4 — Webhooks / CDC: Work Outline and Ambiguity Log

> **Definition level: Low** — Requires CDC scope and design decisions before implementation.

---

## 1. Executive Summary

Phase 4 upgrades webhook intake to production-grade reliability (durable envelope, status transitions, replay, dead-letter, heartbeat) and defines the CDC (Change Data Capture) scope for real-time data sources.

**Current state:** Basic webhook receipt exists; dual persistence (integration_webhook_events + raw_events); replay is a stub; reconcileWebhooks is unimplemented everywhere; CDC is referenced but not designed.

---

## 2. Workstream Overview

| Workstream | Description | Depends on |
|------------|-------------|------------|
| **A. Unify inbound pipeline** | Consolidate webhook persistence and flow | Design decision: single vs dual table |
| **B. Status transitions** | RECEIVED → VALIDATED → QUEUED → PROCESSED (or FAILED/DEAD_LETTERED) | A |
| **C. Replay with reprocessing** | Actually reprocess events on replay, not just reset status | A, B |
| **D. Dead-letter handling** | DLQ integration, retry, resolution UX | B |
| **E. Heartbeat / stale detection** | Degrade integration when no events in expected window | Product: per-provider expectations |
| **F. Reconcile (missed-event recovery)** | Provider-specific gap-fill (Stripe events API, HubSpot incremental, etc.) | Provider design |
| **G. CDC scope and design** | Define what CDC means: Salesforce, DB replication, etc. | Product: CDC scope |

---

## 3. Current Architecture

### 3.1 Tables (three exist)

| Table | Migration | Used by | Purpose |
|-------|-----------|---------|---------|
| `integration_webhook_events` | 143 (Phase 1) | webhook route, webhookIngestionService, replay route | Simple receipt, dedupe, processed_status |
| `integration_inbound_events` | 161 (Phase 4) | inbound-ingest.service, replayScopeResolver (partial) | Durable envelope, ingest_status, dead-letter path |
| `raw_events` | 145 (Phase 3) | webhook-to-raw-event.bridge, signal-processor | Signal pipeline entry point |

### 3.2 Current webhook flow

```
POST /api/integrations/:provider/webhook
  → persistWebhookToRawEvents (raw_events)  ← if orgId resolved
  → ingestWebhook (integration_webhook_events)
  → 200 { received: true, eventId? }
```

- **Dual write:** Webhook payload is written to both `raw_events` and `integration_webhook_events`.
- **No signature validation** in generic route (provider-specific routes may do it).
- **orgId resolution** via `x-integration-account-id` header only; Stripe/HubSpot use provider-specific routes with different resolution.

### 3.3 What exists vs spec (Implementation Guide §11)

| Spec requirement | Status |
|------------------|--------|
| Request receipt | ✅ |
| Signature validation | ⚠️ Partial (Stripe billing route; generic route: no) |
| Dedupe | ✅ (dedupe_key / idempotency) |
| Raw event persistence | ✅ (raw_events + integration_webhook_events) |
| Processing status transitions | ❌ integration_webhook_events has processed_status but no VALIDATED/QUEUED flow |
| Replay/reprocess | ⚠️ Replay route resets to "received"; no reprocessing worker |
| Stale-heartbeat detection | ❌ |
| reconcileWebhooks | ❌ Stub in all runtimes |

---

## 4. Work Breakdown

### 4.1 Workstream A — Unify inbound pipeline

**Ambiguity:** Two envelopes exist. Phase 4 adds a third conceptual path.

**Options:**

1. **Replace integration_webhook_events with integration_inbound_events**  
   - All webhooks → integration_inbound_events first.  
   - Downstream: integration_inbound_events → raw_events (when PROCESSED).  
   - Deprecate integration_webhook_events.

2. **Keep integration_webhook_events, add integration_inbound_events as optional durable layer**  
   - Webhook → integration_webhook_events (legacy) AND integration_inbound_events (when enabled).  
   - More complexity, migration burden.

3. **Single table: extend integration_inbound_events to cover all**  
   - Migrate integration_webhook_events data into integration_inbound_events.  
   - Drop integration_webhook_events.  
   - Requires migration and backfill.

**Clarification needed:** Which option? Recommendation: Option 1 or 3 (single durable inbound table).

**Tasks (assuming Option 1/3):**

- [ ] Wire webhook route to `ingestInboundEvent` (integration_inbound_events) instead of `ingestWebhook`.
- [ ] Add worker/cron to process integration_inbound_events (RECEIVED/QUEUED) → raw_events.
- [ ] Ensure idempotency and dedupe across both tables.
- [ ] Migration: backfill or retire integration_webhook_events.

---

### 4.2 Workstream B — Status transitions

**Spec (§11.3):** RECEIVED → VALIDATED → QUEUED → PROCESSED | FAILED | DEAD_LETTERED.

**Current:** integration_inbound_events has ingest_status with these values; no state machine.

**Tasks:**

- [ ] Define valid transitions and enforcement (e.g. assertValidTransition).
- [ ] VALIDATED: when? (e.g. after signature check and schema validation).
- [ ] QUEUED: when handoff to processor (raw_events intake)?
- [ ] FAILED vs DEAD_LETTERED: max attempts, retry policy.
- [ ] Update inbound-ingest.service and any processors to use transitions.

---

### 4.3 Workstream C — Replay with reprocessing

**Current:** Replay route updates integration_webhook_events processed_status to "received". No worker picks it up.

**Tasks:**

- [ ] Replay route: support integration_inbound_events (or chosen single table).
- [ ] Replay = set ingest_status to QUEUED (or RECEIVED) so processor picks it up.
- [ ] Processor: idempotent reprocessing (raw_events upsert, signal reprocessing).
- [ ] Replay by event ID (existing) + optional replay by time range / job scope.
- [ ] UI: Integration Control Center — "Retry failed", "Replay by ID" (Implementation Guide §11.4).

---

### 4.4 Workstream D — Dead-letter handling

**Current:** integration_dead_letters table exists (Phase 4 migration). integration_action_executions write to it. Inbound events do not.

**Tasks:**

- [ ] On PROCESSED failure after max attempts: insert into integration_dead_letters (INBOUND_EVENT).
- [ ] Retry from DLQ: endpoint or admin action to re-queue.
- [ ] UI: list dead letters, retry, ignore, resolve.

---

### 4.5 Workstream E — Heartbeat / stale detection

**Spec (§11.5):** If webhook integration expects steady traffic and no events arrive in N window → degraded.

**Ambiguity:** What is "expected steady traffic"? Per provider? Per org? Configurable?

**Clarification needed:**

- Which providers are "webhook-based" with expected steady traffic? (Stripe, HubSpot, Jira?)
- Default window (e.g. 24h, 6h)?
- Configurable per org or global?
- How does this interact with connector_health_snapshots?

**Tasks (once clarified):**

- [ ] Cron: for each org+provider with webhook expected, check last event time.
- [ ] If no event in window → update connector health to degraded, record reason.
- [ ] Surface in Integration Control Center.

---

### 4.6 Workstream F — Reconcile (missed-event recovery)

**Spec (§11.4):** "Trigger a reconcile job if the provider supports missed-event recovery."

**Current:** reconcileWebhooks() is a stub in every runtime.

**Ambiguity:** Reconcile semantics vary by provider:

| Provider | Possible reconcile behavior |
|----------|-----------------------------|
| Stripe | Events API: fetch events since last webhook, fill gaps |
| HubSpot | Incremental sync / search API for changed records since checkpoint |
| Jira | Poll recent issues, compare to known webhooks |
| Salesforce | Bulk query or CDC subscription recovery |

**Clarification needed:**

- Which providers support reconcile in v1?
- Per-provider design: API used, checkpoint storage, idempotency.
- UX: manual "Reconcile now" vs scheduled.

**Tasks (once scoped):**

- [ ] Implement reconcileWebhooks for Stripe (Events API).
- [ ] Implement for HubSpot (incremental sync / search).
- [ ] Optional: Jira, Salesforce.
- [ ] Reconcile job creates integration_inbound_events (or raw_events) with source_channel = 'sync' or 'reconcile'.

---

### 4.7 Workstream G — CDC scope and design

**Ambiguity:** "CDC" is used in multiple contexts:

1. **Salesforce CDC** — Change Data Capture / Platform Events. Real-time subscription to object changes.
2. **Database CDC** — Postgres logical replication, Debezium, MySQL binlog, Snowflake streams. Streaming DB changes.
3. **Generic "change"** — Any mechanism that delivers changed records (webhooks, polling, sync).

**Current:**

- Salesforce: `SalesforceStreamingService`, `SalesforceChangeProcessor` — stubs, "CDC webhooks not implemented".
- Postgres/MySQL/Snowflake: use `runIncrementalSync` / `runBackfill` (polling), not CDC.
- Source channels: webhook, sync, backfill, warehouse, internal, file_import, db_read.

**Clarification needed:**

1. **Phase 4 CDC scope**
   - Salesforce CDC only?
   - Postgres/MySQL logical replication (requires infra: Debezium, Kafka, etc.)?
   - Snowflake Streams?
   - None (defer CDC, focus on webhook hardening)?

2. **CDC vs webhook**
   - Is Salesforce CDC a "webhook" (HTTP callback) or a separate streaming protocol?
   - Same pipeline (integration_inbound_events → raw_events) or different?

3. **Infrastructure**
   - Does Phase 4 assume external CDC infra (Kafka, Debezium) or only provider push (Stripe, HubSpot, Jira webhooks)?

**Tasks (once scoped):**

- [ ] If Salesforce CDC in scope: design subscription model, auth, event shape, mapping to integration_inbound_events.
- [ ] If DB CDC in scope: design connector for Debezium/Kafka events, or direct DB stream consumption.
- [ ] Extend source_channel if needed (e.g. 'cdc', 'salesforce_cdc').

---

## 5. Ambiguity Summary (needs product/design input)

| # | Topic | Question | Impact |
|---|-------|----------|--------|
| 1 | Inbound table strategy | Unify into integration_inbound_events and deprecate integration_webhook_events? | Architecture, migration |
| 2 | Heartbeat expectations | Which providers have "expected steady traffic"? Window? Configurable? | Feature scope |
| 3 | Reconcile v1 scope | Which providers get reconcileWebhooks in Phase 4? Per-provider design? | Backend scope |
| 4 | CDC scope | Salesforce CDC? DB CDC (Debezium)? Snowflake Streams? None? | Major scope |
| 5 | CDC pipeline | Same pipeline as webhooks or separate? | Architecture |
| 6 | Signature validation | Require per-provider signature validation in generic route? | Security |
| 7 | Webhook registration | Who registers webhooks (Stripe/HubSpot dashboard vs app-managed)? Jira has jira_webhook_registrations. | UX, ownership |

---

## 6. Suggested Execution Order (once clarified)

1. **Lock decisions** on table strategy (A), reconcile scope (F), CDC scope (G).
2. **Implement A + B** — Unify inbound, status transitions.
3. **Implement C + D** — Replay, dead-letter.
4. **Implement E** — Heartbeat (after product defines expectations).
5. **Implement F** — Reconcile for chosen providers.
6. **Implement G** — CDC (if in scope).

---

## 7. Definition of Done (Phase 4)

- [ ] Single durable inbound envelope used for webhooks (or clear migration path).
- [ ] Status transitions (RECEIVED → … → PROCESSED/FAILED/DEAD_LETTERED) enforced.
- [ ] Replay triggers actual reprocessing.
- [ ] Dead-letter flow for inbound events; retry/resolve UX.
- [ ] Heartbeat logic for webhook-based integrations (if scoped).
- [ ] reconcileWebhooks implemented for at least Stripe (and optionally HubSpot).
- [ ] CDC design documented and, if in scope, implemented for chosen providers.
- [ ] Integration Control Center: view events, failures, replay, reconcile.

---

## 8. References

- Implementation Guide §11 — Webhook intake and replay  
- Migration 161 — integration_inbound_events, integration_dead_letters, integration_reconciliation_checks  
- Migration 143 — integration_webhook_events  
- Migration 145 — raw_events  
- `src/modules/integrations/webhooks/webhookIngestionService.ts`  
- `src/modules/integrations/reliability/services/inbound-ingest.service.ts`  
- `src/modules/signals/ingestion/webhook-to-raw-event.bridge.ts`  
- `src/app/api/integrations/[provider]/webhook/route.ts`  
- `src/app/api/integrations/[provider]/webhook/replay/route.ts`  
