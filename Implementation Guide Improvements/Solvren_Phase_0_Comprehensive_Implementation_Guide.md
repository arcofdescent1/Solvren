# Solvren Phase 0 — Comprehensive Implementation Guide

## Purpose

This Phase 0 guide resets Solvren from a strong but change-centric governance application into a modular operational intelligence platform whose first major workflow is change governance. The purpose of Phase 0 is not feature expansion. It is to establish the product model, system boundaries, data contracts, lifecycle model, ownership model, and migration path required to close the current gaps around integration depth, issue unification, impact credibility, routing, and verification.

This guide is intended to be handed directly to product, engineering, and design. It defines what must be built, what must be renamed, what must be preserved, and what must not yet be attempted.

---

## 1. Executive summary

### Phase 0 mission

Turn Solvren into a platform with one clear internal truth:

**Solvren manages issues across business systems in a closed loop.**

A change request is one source of an issue. It is not the platform itself.

### What Phase 0 changes

Phase 0 introduces:
- one canonical issue lifecycle
- one canonical issue object
- one domain-oriented module architecture
- one source taxonomy for all risk and issue creation
- one execution and verification contract
- one consistent product language model

### What Phase 0 does not do

Phase 0 does not yet:
- fully deepen integrations
- build the full identity graph
- ship detector packs
- calculate production-grade impact models
- automate write-back actions across all systems

Those come later. Phase 0 makes them possible.

---

## 2. Why this phase is required

The current repo already has significant product depth. It includes a Next.js application, Supabase-backed data model, dashboards, change intake, approvals, evidence, executive surfaces, Slack/Jira/GitHub/HubSpot/Salesforce/NetSuite surfaces, billing, notifications, docs, role models, and a large migration history. It also already contains early modularization with `src/modules/eventbus`, `src/modules/integrations`, and `src/modules/risk`, while most business logic still lives across a large `src/services` surface. The app therefore has momentum, but not yet a single coherent product backbone.

The core problem is architectural and product-structural:
- the codebase is still centered around changes and governance objects
- integrations exist, but not under one strict platform contract
- issue semantics are fragmented across changes, incidents, signals, outbox, approvals, and revenue surfaces
- product language is not yet consistently aligned to the North Star of detect → quantify → prioritize → route → resolve → verify

Phase 0 solves that by creating the internal operating model that every later phase must implement against.

---

## 3. Product North Star translation for implementation

The Solvren North Star defines a closed-loop system that detects issues, quantifies impact, prioritizes action, routes ownership, tracks resolution, and verifies outcomes. It also explicitly frames Solvren as a decision engine plus execution layer rather than a CRM, BI tool, or ticketing system. fileciteturn3file0L5-L24 fileciteturn3file1L8-L18

Phase 0 must convert that into product-operating rules.

### Product rules

1. Every material problem in Solvren is an **issue**.
2. Every issue has a **source**.
3. Every issue has an **owner**.
4. Every issue has an **impact posture**, even if impact is temporarily unknown.
5. Every issue has a **resolution state**.
6. Every issue has a **verification state**.
7. Every issue must be traceable back to the source evidence that created it.
8. Every issue must be representable in executive, operational, and engineering views.
9. Changes remain a first-class workflow, but they must plug into the issue lifecycle rather than define it.
10. No Phase 1+ work may bypass the issue model.

---

## 4. Product scope for Phase 0

### In scope

- product language reset
- architecture boundary reset
- canonical domain model
- issue state machine
- source taxonomy
- module/file structure
- schema foundation for issues/actions/verification
- mapping of current change-governance features into the new model
- UI restructuring plan for issue-first surfaces
- API contract foundation
- telemetry and audit requirements
- migration strategy from current structures
- acceptance criteria and rollout sequence

### Out of scope

- production-quality detector pack implementation
- full connector rebuild
- warehouse ingestion
- identity resolution UI
- advanced ML or AI scoring
- pricing engine implementation
- broad UI redesign beyond what is needed to establish issue-first navigation

---

## 5. Product language and vocabulary reset

This section is mandatory. Product, engineering, design, docs, and GTM must use this language consistently.

### Canonical nouns

**Source**  
An originating mechanism that introduces a potential problem into Solvren. Examples: change request, detector, integration event, incident, manual report.

**Signal**  
A normalized observation or event coming from a connected system.

**Issue**  
The canonical representation of a business or operational problem that needs triage, routing, resolution, and verification.

**Impact Assessment**  
A calculation or estimate of revenue risk, customer effect, operational burden, and confidence.

**Action**  
A recommended or executed step taken on an issue.

**Task**  
A routable work artifact, internal or external, created to drive execution.

**Resolution**  
The state indicating the team believes the issue has been addressed.

**Verification**  
The state and evidence proving the issue condition is actually cleared or acceptably contained.

### Deprecated or reduced-scope framing

These may remain as UX terms where helpful, but may not be the primary system model:
- “change” as the main app object
- “alert” as a top-level object instead of issue or signal
- “risk event” as a replacement for issue
- “approval object” detached from issue lifecycle

### Product copy changes

Top navigation and docs should move toward:
- Issues
- Integrations
- Signals
- Changes
- Incidents
- Reviews / Approvals
- Executive
- Settings

not:
- Change-first-only navigation
- disconnected governance nouns that hide the bigger platform

---

## 6. Current-state to target-state interpretation

### Current-state strengths to preserve

Preserve these as product assets:
- change intake and submission workflow
- approval and evidence framework
- readiness and SLA concepts
- incidents and timeline support
- domain governance templates
- executive metrics scaffolding
- integration-specific surfaces for Slack, Jira, GitHub, HubSpot, Salesforce, NetSuite
- RLS, orgs, invites, roles, billing, notifications, and docs

### Current-state structural problems to solve

1. Too much business logic remains service-spread and integration-specific.
2. The existing modularization is only partial.
3. Change-governance is too central relative to the full North Star.
4. Issue lifecycle semantics are not universal.
5. Verification is not yet the universal end state for platform work.
6. Routing and execution concepts are fragmented by workflow.

### Target state after Phase 0

- all future product work maps to one issue model
- all future system events can become normalized signals and then issues
- changes become a source + workflow specialization under the issue system
- integrations are modeled as platform connectors, not one-off panels
- executive surfaces can aggregate any issue, not just change risk

---

## 7. Canonical domain architecture

Phase 0 introduces strict internal domains.

## Required domains

### 7.1 org-access
Handles org membership, role mapping, invitations, restricted visibility, RBAC, permissions, and tenancy.

### 7.2 integration-platform
Owns integration account records, connector registration, auth status, sync state, webhook intake envelope, and integration health.

### 7.3 signal-ingestion
Owns raw event intake, normalization contracts, idempotency, event replay metadata, and normalized signal persistence.

### 7.4 detection
Owns detectors, evaluation orchestration, detector config, evidence generation, dedupe, and issue creation requests.

### 7.5 impact
Owns impact contracts, model versions, confidence, and impact state attachment to issues.

### 7.6 issues
Owns issue creation, lifecycle, source linkage, triage state, assignee state, issue history, and issue queries.

### 7.7 execution-routing
Owns routing rules, owner derivation, task generation, external execution adapters, SLA state, and escalation.

### 7.8 verification
Owns verification runs, verification evidence, pass/fail semantics, re-open logic, and verified outcome metrics.

### 7.9 change-governance
Owns change intake, approval requirements, evidence requirements, readiness, submit/review flows, and links changes into issue lifecycle.

### 7.10 analytics-reporting
Owns executive aggregation, saved views, search indexing, reporting snapshots, and dashboard-facing derived data.

---

## 8. Required codebase restructuring

The repo already contains `src/modules`, but most logic still lives in `src/services`. The target is not an immediate rewrite. It is a controlled boundary migration.

## Target source structure

```text
src/
  modules/
    org-access/
      domain/
      application/
      infrastructure/
      api/
      index.ts
    integrations/
      domain/
      application/
      infrastructure/
      api/
      index.ts
    signals/
      domain/
      application/
      infrastructure/
      api/
      index.ts
    detection/
      domain/
      application/
      infrastructure/
      api/
      index.ts
    impact/
      domain/
      application/
      infrastructure/
      api/
      index.ts
    issues/
      domain/
      application/
      infrastructure/
      api/
      index.ts
    execution/
      domain/
      application/
      infrastructure/
      api/
      index.ts
    verification/
      domain/
      application/
      infrastructure/
      api/
      index.ts
    change-governance/
      domain/
      application/
      infrastructure/
      api/
      index.ts
    reporting/
      domain/
      application/
      infrastructure/
      api/
      index.ts
```

## Migration policy for existing files

1. `src/services` remains temporarily as legacy application services.
2. No new business logic should be added to `src/services` after Phase 0 starts.
3. New code must land under `src/modules/*`.
4. Existing service files should be wrapped or imported into module application services until they can be migrated.
5. UI components may continue to consume old APIs temporarily, but all new APIs must be module-owned.

## Immediate module landing zones using current repo strengths

- move `src/modules/eventbus/*` into `src/modules/signals` and `src/modules/detection` over time
- move `src/modules/integrations/*` into the new `integrations` structure without breaking imports
- move `src/modules/risk/*` into `impact`, `detection`, or `issues` depending on semantics

---

## 9. Canonical source taxonomy

Every issue must originate from one source type.

## Source types

- `change`
- `detector`
- `integration_event`
- `incident`
- `manual`
- `system_health`
- `verification_failure`

## Source contract

Every source must provide:
- source type
- source record ID or external ref
- source time
- source title or event summary
- source evidence envelope
- source domain
- source confidence

## Mapping current product surfaces into source types

- change intake / approval / readiness flows → `change`
- risk evaluators and correlation outputs → `detector`
- webhook failures or sync-derived failures → `integration_event`
- incident module entries → `incident`
- manually created ops issue → `manual`
- connector degradation or stale sync blind spots → `system_health`
- failed recheck or regression after resolution → `verification_failure`

---

## 10. Canonical issue object

This is the core of Phase 0.

## Issue responsibilities

The issue object must be able to support:
- executive summarization
- operational queueing
- engineering traceability
- routing and task generation
- change linking
- impact tracking
- verification and reopening

## Required issue fields

### issues
- `id` UUID primary key
- `org_id` UUID not null
- `issue_key` text unique per org, human-readable sequence like `ISS-001245`
- `source_type` enum not null
- `source_ref` text not null
- `source_event_time` timestamptz null
- `domain_key` text not null
- `title` text not null
- `description` text null
- `summary` text null
- `severity` enum not null default `medium`
- `status` enum not null default `open`
- `verification_status` enum not null default `pending`
- `priority_score` numeric(8,2) null
- `impact_score` numeric(8,2) null
- `confidence_score` numeric(5,2) null
- `owner_user_id` UUID null
- `owner_team_key` text null
- `sla_policy_key` text null
- `opened_at` timestamptz not null default now()
- `triaged_at` timestamptz null
- `assigned_at` timestamptz null
- `in_progress_at` timestamptz null
- `resolved_at` timestamptz null
- `verified_at` timestamptz null
- `dismissed_at` timestamptz null
- `closed_reason` text null
- `reopen_count` integer not null default 0
- `created_by` UUID null
- `updated_at` timestamptz not null default now()

### Supporting enums

`issue_severity`
- `low`
- `medium`
- `high`
- `critical`

`issue_status`
- `open`
- `triaged`
- `assigned`
- `in_progress`
- `resolved`
- `verified`
- `dismissed`

`verification_status`
- `pending`
- `passed`
- `failed`
- `not_required`

## Supporting linkage tables

### issue_sources
- `id`
- `issue_id`
- `source_type`
- `source_ref`
- `evidence_json`
- `created_at`

### issue_entities
- `id`
- `issue_id`
- `entity_type`
- `external_system`
- `external_object_type`
- `external_id`
- `canonical_entity_id` nullable in Phase 0
- `entity_display_name`
- `metadata_json`
- `created_at`

### issue_history
- `id`
- `issue_id`
- `event_type`
- `event_actor_type`
- `event_actor_ref`
- `old_state_json`
- `new_state_json`
- `metadata_json`
- `created_at`

### issue_actions
- `id`
- `issue_id`
- `action_type`
- `action_status`
- `requested_by`
- `external_system`
- `target_ref`
- `request_json`
- `response_json`
- `error_json`
- `created_at`
- `executed_at`

### issue_comments
- `id`
- `issue_id`
- `author_user_id`
- `body`
- `visibility`
- `created_at`

---

## 11. State machine and lifecycle contract

This state machine is mandatory and must be enforced in application logic.

## Canonical lifecycle

`open` → `triaged` → `assigned` → `in_progress` → `resolved` → `verified`

Alternative terminal path:
`open|triaged|assigned|in_progress` → `dismissed`

Regression path:
`resolved` → verification failure → `open`
`verified` → new linked evidence/regression → new issue or reopen depending on rule

## Transition rules

### open → triaged
Allowed when:
- source evidence exists
- issue is not duplicate-dismissed
- initial severity and domain are set

### triaged → assigned
Allowed when:
- owner user or owner team exists
- routing rationale recorded

### assigned → in_progress
Allowed when:
- assignee accepted or execution task created

### in_progress → resolved
Allowed when:
- resolution summary entered
- at least one action or task exists, unless manual issue type exempt
- verification policy attached

### resolved → verified
Allowed when:
- verification run passes or manual attestation accepted

### any active state → dismissed
Allowed when:
- duplicate confirmed, false positive confirmed, or accepted risk documented

### resolved → open
Allowed when:
- verification fails
- issue condition persists
- regression detected

## Audit requirements

Every state transition must write:
- issue_history row
- audit log entry
- timeline event for UI
- optional notification or task event depending on policy

---

## 12. Verification foundation in Phase 0

Verification is not optional because the North Star explicitly requires resolution verification and regression prevention. fileciteturn3file0L80-L82

Phase 0 does not need complete verification logic for every issue type, but it must establish the contract.

## Verification tables

### verification_runs
- `id`
- `issue_id`
- `verification_type`
- `status`
- `started_at`
- `completed_at`
- `result_summary`
- `result_json`
- `triggered_by`

### verification_evidence
- `id`
- `verification_run_id`
- `evidence_type`
- `reference_json`
- `summary`
- `created_at`

## Verification types

- `rule_recheck`
- `integration_probe`
- `manual_attestation`
- `metric_delta`

## Verification statuses

- `pending`
- `running`
- `passed`
- `failed`
- `waived`

## Mandatory behavior in Phase 0

Every issue record must have a verification policy placeholder and verification status field, even if actual verification implementation comes later.

---

## 13. Impact foundation in Phase 0

The North Star requires impact quantification in terms of revenue, customers, and operational cost. fileciteturn3file0L54-L59 Phase 0 does not need final models, but it must make impact attachment a first-class contract.

## Tables

### impact_assessments
- `id`
- `issue_id`
- `model_key`
- `model_version`
- `direct_revenue_loss`
- `revenue_at_risk`
- `customer_count_affected`
- `operational_cost_estimate`
- `confidence_score`
- `assumptions_json`
- `calculated_at`

## Mandatory behavior in Phase 0

- issue detail APIs must reserve shape for impact
- dashboards must distinguish `impact_unknown` from zero impact
- no future issue APIs may omit impact metadata fields

---

## 14. Routing and execution foundation in Phase 0

The North Star requires ownership and task execution. fileciteturn3file0L68-L78 Phase 0 establishes the contracts.

## Tables

### routing_rules
- `id`
- `org_id`
- `domain_key`
- `source_type`
- `severity_min`
- `conditions_json`
- `owner_type`
- `owner_ref`
- `sla_policy_key`
- `escalation_policy_json`
- `active`

### execution_tasks
- `id`
- `issue_id`
- `external_system`
- `external_task_id`
- `task_type`
- `status`
- `assignee_ref`
- `due_at`
- `sync_status`
- `created_at`
- `updated_at`

## Mandatory behavior in Phase 0

- every issue must support a routeable owner
- routing rule evaluation must become a module responsibility, not ad hoc service logic
- external execution artifacts must link back to issue_id

---

## 15. Change-governance remapping

This is critical because the current repo already has deep change functionality.

## Product rule

Do not remove the existing change-governance value proposition. Reframe it.

## How changes now fit

A change is:
- a domain workflow
- a source of potential issues
- a linked execution object
- sometimes a mitigation action
- sometimes the cause of a later issue or incident

## Required links

### change_issue_links
- `id`
- `change_id`
- `issue_id`
- `link_type` (`origin`, `related`, `caused`, `mitigates`, `blocked_by`)
- `created_at`

## UI requirements

On change detail page:
- show linked issues
- show issue status summary
- show whether this change created, mitigated, or was blocked by issues

On issue detail page:
- show originating or related changes
- show approval/evidence status when source_type is `change`

## Workflow changes

- submitting a high-risk change can create or update an issue record
- a failed approval can manifest as issue state or linked governance blocker
- a change-induced incident can create a linked issue sourced from incident or verification failure

---

## 16. API contract reset

Phase 0 should introduce canonical issue APIs while allowing legacy change APIs to remain temporarily.

## Required issue endpoints

### Create or intake
- `POST /api/issues`
- `POST /api/issues/from-source`

### Read
- `GET /api/issues`
- `GET /api/issues/:issueId`
- `GET /api/issues/:issueId/history`
- `GET /api/issues/:issueId/actions`
- `GET /api/issues/:issueId/verification`

### Mutate lifecycle
- `POST /api/issues/:issueId/triage`
- `POST /api/issues/:issueId/assign`
- `POST /api/issues/:issueId/start`
- `POST /api/issues/:issueId/resolve`
- `POST /api/issues/:issueId/dismiss`
- `POST /api/issues/:issueId/reopen`

### Actions
- `POST /api/issues/:issueId/actions`
- `POST /api/issues/:issueId/comments`

### Verification
- `POST /api/issues/:issueId/verification/run`
- `POST /api/issues/:issueId/verification/attest`

## Response shape standard

```json
{
  "id": "uuid",
  "issueKey": "ISS-001245",
  "sourceType": "change",
  "sourceRef": "chg_123",
  "domainKey": "revenue",
  "title": "High-risk change missing required evidence",
  "status": "triaged",
  "verificationStatus": "pending",
  "severity": "high",
  "priorityScore": 82.5,
  "impact": {
    "revenueAtRisk": 12000,
    "customerCountAffected": 48,
    "operationalCostEstimate": 900,
    "confidenceScore": 0.61,
    "modelKey": "phase0-placeholder"
  },
  "owner": {
    "userId": "uuid",
    "teamKey": "revops"
  },
  "links": {
    "changes": [],
    "entities": [],
    "tasks": []
  },
  "timestamps": {
    "openedAt": "...",
    "updatedAt": "...",
    "resolvedAt": null,
    "verifiedAt": null
  }
}
```

---

## 17. UI and navigation specification

Phase 0 does not need a full redesign, but it must alter the information architecture so the product reads correctly.

## Navigation changes

### Add or elevate
- Issues
- Integrations
- Changes
- Incidents
- Executive
- Settings

### De-emphasize as the sole backbone
- change-centric entry points that make the app look like only a release governance tool

## Required new or updated pages

### 17.1 Issues index
Purpose: operational home for all detected and active problems.

Must support:
- filter by source type
- filter by domain
- filter by severity
- filter by status
- filter by verification status
- sort by priority, impact, age, SLA, created time
- saved views
- quick counts for open, assigned, resolved pending verification, reopened

### 17.2 Issue detail page
Must show:
- header with title, source, severity, owner, status, verification
- impact summary card
- evidence panel
- source panel
- linked entities
- linked changes
- action/task panel
- timeline/history
- verification panel

### 17.3 Change detail updates
Must show:
- linked issues card
- risk and issue lineage
- governance-to-issue mapping

### 17.4 Integrations overview updates
Must show:
- connection health
- last sync
- monitoring coverage
- known blind spots
- issue counts generated by integration

### 17.5 Executive dashboard updates
Must aggregate across issue model:
- revenue at risk by open issues
- unresolved critical issues
- verified wins
- reopened after failed verification
- top issue sources

## Design guidance

Keep the existing enterprise UI direction, which is described as clean, modern, and action-oriented with clear hierarchy. fileciteturn3file1L20-L31 The key Phase 0 UI change is not visual reinvention; it is issue-first clarity.

---

## 18. Documentation deliverables required in the repo

Create these files under `/docs/architecture/`:

- `01_phase0_north_star_translation.md`
- `02_phase0_domain_model.md`
- `03_phase0_issue_lifecycle.md`
- `04_phase0_module_boundaries.md`
- `05_phase0_api_contracts.md`
- `06_phase0_data_migration_plan.md`
- `07_phase0_ui_information_architecture.md`
- `08_phase0_rollout_and_acceptance.md`

Each document must be written for both product and engineering, not engineering only.

---

## 19. Database migration plan

The current repo has extensive Supabase migrations. Phase 0 must extend rather than rewrite them.

## New migrations required

Create a migration pack with the following files:

1. `117_phase0_issue_core.sql`
2. `118_phase0_issue_links_and_history.sql`
3. `119_phase0_verification_foundation.sql`
4. `120_phase0_impact_foundation.sql`
5. `121_phase0_execution_routing_foundation.sql`
6. `122_phase0_change_issue_links.sql`
7. `123_phase0_issue_rls.sql`
8. `124_phase0_backfill_change_to_issue_links.sql`

## Migration details

### 117_phase0_issue_core.sql
Create enums and `issues` table. Add indexes on:
- org_id + status
- org_id + severity
- org_id + source_type
- org_id + domain_key
- org_id + verification_status
- org_id + priority_score desc

### 118_phase0_issue_links_and_history.sql
Create:
- issue_sources
- issue_entities
- issue_history
- issue_actions
- issue_comments

### 119_phase0_verification_foundation.sql
Create:
- verification_runs
- verification_evidence

### 120_phase0_impact_foundation.sql
Create:
- impact_assessments

### 121_phase0_execution_routing_foundation.sql
Create:
- routing_rules
- execution_tasks

### 122_phase0_change_issue_links.sql
Create:
- change_issue_links

### 123_phase0_issue_rls.sql
Apply org-scoped RLS consistent with existing org member and role logic.

### 124_phase0_backfill_change_to_issue_links.sql
Backfill issue records for existing high-risk changes, incidents, or governance blockers where appropriate. Do not blindly create issues for every historical record. Backfill only records matching clear criteria, such as currently active, not completed, materially risky, or unresolved.

---

## 20. Backfill policy

This needs product and engineering agreement before execution.

## Backfill principles

1. Do not create noise.
2. Backfill only active or strategically important records.
3. Preserve lineage from historical change and incident records.
4. Tag all backfilled issues with `source_type` and `source_ref`.
5. Mark backfilled impact as `phase0_estimated` where needed.

## Recommended backfill sets

### Backfill set A
Current unresolved incidents.

### Backfill set B
Current unresolved or submitted high-risk changes.

### Backfill set C
Changes blocked on approvals or evidence that represent live risk.

### Do not backfill initially
- resolved historical low-risk changes
- old alerts without actionable ownership
- stale data without clear relevance

---

## 21. Service-to-module migration map

This section tells engineering exactly what to do with the current services surface.

## Immediate wraps in Phase 0

### Wrap into `modules/change-governance`
- `src/services/changes/*`
- `src/services/changeValidation/*`
- `src/services/evidence/*`
- `src/services/approvals/*`
- `src/services/domains/approvalRequirements.ts`

### Wrap into `modules/issues`
- issue lifecycle logic currently embedded across risk, incidents, and change pages
- timeline/history recording logic
- audit-to-issue event adapters

### Wrap into `modules/execution`
- notification enqueue and recipient resolution logic where execution-oriented
- Jira task creation and sync hooks
- Slack thread / assignment / follow-up actions

### Wrap into `modules/integrations`
- auth services for Slack, Jira, GitHub, HubSpot, Salesforce, NetSuite
- health/status readers
- connector registry logic

### Wrap into `modules/impact`
- revenue impact services
- executive metrics contributors where issue-based
- exposure and scoring services that map to impact posture

### Wrap into `modules/verification`
- readiness, evidence completion, or re-evaluation checks that verify a fix or governance condition

## Important rule

Wrap first. Rewrite second. Preserve behavior while changing architecture.

---

## 22. Application-layer use cases to implement

These are the first application services that must exist under modules.

## issues module use cases
- `createIssueFromSource()`
- `triageIssue()`
- `assignIssue()`
- `startIssueWork()`
- `resolveIssue()`
- `dismissIssue()`
- `reopenIssue()`
- `listIssues()`
- `getIssueDetail()`
- `appendIssueHistory()`

## change-governance module use cases
- `linkChangeToIssue()`
- `createIssueForHighRiskChangeIfNeeded()`
- `syncChangeGovernanceStateToIssue()`

## verification module use cases
- `initializeVerificationPolicy()`
- `scheduleVerificationAfterResolution()`
- `recordVerificationOutcome()`

## execution module use cases
- `deriveIssueOwner()`
- `applyRoutingRules()`
- `createExecutionTask()`
- `recordExternalActionResult()`

## impact module use cases
- `attachPlaceholderImpact()`
- `recalculateIssueImpact()`

---

## 23. Product requirements for role-based experiences

The North Star identifies executives, RevOps/operations, engineering/IT, and department leaders as core personas. fileciteturn3file0L83-L94 Phase 0 must align the app around those experiences.

## Executive experience requirements

Executives must be able to answer:
- what is currently breaking?
- what is revenue at risk?
- what is unresolved and urgent?
- what has been fixed and verified?
- what is slipping or reopening?

## RevOps / operations requirements

Ops users must be able to:
- manage the Issues queue
- filter by system/domain/source
- assign owners
- push tasks into execution systems
- confirm issue lineage

## Engineering / IT requirements

Engineering users must be able to:
- inspect evidence and affected systems
- trace source events and linked changes
- see verification expectations
- distinguish noise from action-worthy issues

## Department leader requirements

Department leaders must be able to:
- view only relevant domain issues
- understand ownership and deadlines
- see summaries without technical overload

---

## 24. Telemetry, observability, and audit requirements

Phase 0 must install observability around the new architecture, otherwise the migration will create blind spots.

## Required telemetry events

- `issue_created`
- `issue_triaged`
- `issue_assigned`
- `issue_started`
- `issue_resolved`
- `issue_verified`
- `issue_reopened`
- `issue_dismissed`
- `issue_action_created`
- `verification_run_started`
- `verification_run_completed`
- `change_linked_to_issue`
- `routing_rule_applied`

## Required metadata

All telemetry should include:
- org_id
- issue_id where applicable
- source_type
- domain_key
- actor_type
- actor_ref
- timestamp

## Audit requirements

- all lifecycle transitions audit-logged
- all ownership changes audit-logged
- all issue/action link changes audit-logged
- all verification outcomes audit-logged

---

## 25. Search requirements

The current repo already contains search work. Phase 0 must ensure issues become searchable first-class objects.

## Search index requirements

Issue search documents must index:
- issue key
- title
- description/summary
- source type
- source ref
- domain
- severity
- status
- owner
- linked change IDs
- linked external entities
- impact values where present

## Search UX requirements

Global search must return issues alongside changes, incidents, docs, and integrations, with issue-specific badges for severity and status.

---

## 26. Testing requirements

Phase 0 is foundational, so testing must be stronger than normal feature work.

## Required test layers

### Unit tests
- issue state machine transitions
- routing rule selection
- issue creation from source payloads
- change-to-issue linking behavior
- verification initialization

### Integration tests
- API lifecycle transitions
- RLS behavior for issue visibility
- issue creation from change source
- issue action persistence and timeline

### E2E tests
- create or backfill issue from a high-risk change
- triage and assign an issue
- resolve and initiate verification
- verify issue appears in executive and ops views correctly

## Required test fixtures

Seed data must include:
- one org with revenue domain enabled
- one unresolved high-risk change
- one unresolved incident
- one issue backfilled from change
- one issue pending verification

---

## 27. Rollout plan

## Step 1 — architecture and schema
- merge migration pack
- create module skeletons
- add issue APIs behind feature flags

## Step 2 — change remapping
- add change_issue_links
- expose linked issues on existing change pages
- create backfill job for eligible changes/incidents

## Step 3 — issue UI release
- ship Issues index and Issue detail pages
- keep old change-centric flows in place

## Step 4 — reporting alignment
- update executive and ops views to aggregate via issue model

## Step 5 — policy enforcement
- all new feature work must land against the issue model
- deprecate direct lifecycle extensions to legacy change-only flows

---

## 28. Non-negotiable acceptance criteria

Phase 0 is complete only when all of the following are true.

1. Solvren has a single canonical issue object used across product and engineering.
2. A change can create or link to an issue without defining the whole product.
3. There is one enforced issue lifecycle with verification state.
4. The codebase has formal domain boundaries under `src/modules`.
5. New APIs exist for issue listing, detail, assignment, resolution, and verification.
6. At least one existing high-risk change flow maps into the issue model end to end.
7. Existing executive views can aggregate issues, not only change risk artifacts.
8. Existing integration and governance work can be explained as part of the broader platform model.
9. Product, design, and docs all use the new vocabulary consistently.
10. Future Phase 1 work can deepen integrations without inventing a parallel object model.

---

## 29. Product handoff notes

### Message to product

Phase 0 is the product reframing phase. It is what allows Solvren to become a revenue protection platform instead of staying a sophisticated change-governance application. Product should not treat this as invisible refactoring only. It materially changes the way the product is explained, navigated, measured, and sold.

### Message to engineering

Do not rewrite the whole app. Wrap and migrate. Preserve all existing enterprise-hardening work around auth, orgs, RLS, notifications, billing, and governance. The goal is to install one durable backbone that all future integration, detector, impact, routing, and verification work can reuse.

### Message to design

The main design job in Phase 0 is not polish. It is hierarchy correction. The app must visually communicate that Issues are the operational center of gravity, while Changes are one important workflow within that center.

---

## 30. Immediate next document after approval

Once this Phase 0 guide is approved, engineering should receive a second packet with implementation-ready detail:
- exact SQL migration files
- exact TypeScript interfaces and Zod schemas
- API request/response types
- module-by-module file scaffolds
- UI page wireframes and component responsibilities
- test case matrix by feature

That packet should be written as `Solvren Phase 0 — Build Specification Pack`.

