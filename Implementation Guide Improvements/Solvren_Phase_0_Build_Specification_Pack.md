# Solvren Phase 0 — Build Specification Pack

## Document purpose

This document completes Phase 0 and is intended to be handed directly to product, engineering, and design as the implementation-ready follow-on to the Phase 0 Comprehensive Implementation Guide. The first guide established the product reset. This guide defines exactly what must be built, where it should live in the current repository, how the data model should change, how the APIs should behave, how the UI should be restructured, how existing change-governance functionality should be remapped, and how the rollout should be executed without destabilizing the rest of the platform.

The goal of Phase 0 is to install a single durable backbone so Solvren can evolve from a change-centric governance product into an issue-centric operational intelligence platform where change governance remains a major workflow, but not the only one.

This pack assumes the current repository structure includes:
- `src/app` App Router surfaces and API routes
- `src/components` page and workflow components
- `src/lib` shared utilities, auth, integrations, metrics, governance, observability
- `src/modules/eventbus`, `src/modules/integrations`, `src/modules/risk`
- `src/services/*` legacy but active business-logic surface
- `supabase/migrations/*` with migrations through `134_organizations_enterprise_fields.sql`

---

# 1. Phase 0 exit criteria

Phase 0 is only considered complete when all of the following are true:

1. Solvren has a single canonical issue object and lifecycle.
2. Existing change workflows can create and link issues end to end.
3. The repository has a stable module boundary plan under `src/modules` and no new business logic is added to `src/services`.
4. Canonical issue APIs exist and are used by at least one real UI path.
5. Issue-first navigation exists in the application shell.
6. Executive and ops views can aggregate issues, not only change artifacts.
7. Verification and impact have first-class placeholders in the schema and APIs.
8. Routing and execution have first-class placeholders in the schema and APIs.
9. Backfill has run for at least one live class of existing records.
10. Product, engineering, and design all use the new vocabulary consistently.

---

# 2. Implementation principles

## 2.1 Preserve the wedge
Do not rip out existing strengths. Current change intake, approvals, evidence, readiness, incident handling, audit, notifications, and executive reporting are assets.

## 2.2 Wrap before rewrite
The current service layer is broad. For Phase 0, wrap legacy logic behind new module application services. Rewrite only where the old model blocks the new issue backbone.

## 2.3 Issue-first, not detector-first
Detection comes later. Phase 0 is about creating the canonical object model that future detectors, integrations, and workflows must target.

## 2.4 No parallel models
No new workflow may introduce a competing top-level object for business problems. Everything becomes an issue or links to one.

## 2.5 Auditability is mandatory
Every lifecycle transition, ownership change, action creation, and verification outcome must remain inspectable.

---

# 3. Product model to implement

## 3.1 Canonical hierarchy

Use this hierarchy everywhere in code, product copy, and documentation:

- **Source**: the originating mechanism of a possible problem
- **Signal**: a normalized system observation or event
- **Issue**: the canonical problem record
- **Impact Assessment**: the attached business impact posture
- **Action**: a recommended or executed step
- **Task**: a routable unit of work, internal or external
- **Resolution**: the believed fix state
- **Verification**: evidence-backed confirmation the issue is actually cleared

## 3.2 Supported source types in Phase 0

```ts
export type IssueSourceType =
  | 'change'
  | 'detector'
  | 'integration_event'
  | 'incident'
  | 'manual'
  | 'system_health'
  | 'verification_failure';
```

## 3.3 Canonical lifecycle

```ts
export type IssueStatus =
  | 'open'
  | 'triaged'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'verified'
  | 'dismissed';

export type VerificationStatus =
  | 'pending'
  | 'passed'
  | 'failed'
  | 'not_required';
```

Allowed transitions:
- `open -> triaged`
- `triaged -> assigned`
- `assigned -> in_progress`
- `in_progress -> resolved`
- `resolved -> verified`
- `open|triaged|assigned|in_progress -> dismissed`
- `resolved -> open` on verification failure
- `verified -> open` only by explicit regression policy or issue recreation rule

---

# 4. Repository changes

## 4.1 New module structure

Create the following structure under `src/modules`:

```text
src/modules/
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

## 4.2 Module responsibilities

### `src/modules/issues`
Owns canonical issue creation, lifecycle, history, querying, comments, linkages, and API contracts.

### `src/modules/change-governance`
Owns change-specific logic and adapters from existing change workflows into issues.

### `src/modules/impact`
Owns placeholder impact attachment and recalculation hooks.

### `src/modules/verification`
Owns verification policy initialization and run records.

### `src/modules/execution`
Owns routing rule evaluation, owner derivation, task creation, and external action logging.

### `src/modules/integrations`
Remains the connector landing zone and should absorb existing integration-specific services over time.

### `src/modules/reporting`
Owns issue-based dashboard query surfaces and executive summaries.

## 4.3 Legacy service policy

From the moment this pack is approved:
- `src/services/*` becomes a legacy layer.
- Existing services may be called from module application services.
- No new business logic may originate in `src/services/*`.
- Any bug fixes in legacy files must be paired with a migration ticket to move that behavior into the correct module.

---

# 5. File-by-file module scaffolding

## 5.1 Issues module

Create these files:

```text
src/modules/issues/domain/types.ts
src/modules/issues/domain/stateMachine.ts
src/modules/issues/domain/validators.ts
src/modules/issues/application/createIssueFromSource.ts
src/modules/issues/application/triageIssue.ts
src/modules/issues/application/assignIssue.ts
src/modules/issues/application/startIssueWork.ts
src/modules/issues/application/resolveIssue.ts
src/modules/issues/application/dismissIssue.ts
src/modules/issues/application/reopenIssue.ts
src/modules/issues/application/listIssues.ts
src/modules/issues/application/getIssueDetail.ts
src/modules/issues/application/addIssueComment.ts
src/modules/issues/application/appendIssueHistory.ts
src/modules/issues/infrastructure/IssueRepository.ts
src/modules/issues/infrastructure/IssueHistoryRepository.ts
src/modules/issues/infrastructure/IssueQueryRepository.ts
src/modules/issues/infrastructure/IssueApiMapper.ts
src/modules/issues/api/schemas.ts
src/modules/issues/api/handlers.ts
src/modules/issues/index.ts
```

### Responsibilities
- `types.ts`: canonical TS types and branded IDs
- `stateMachine.ts`: allowed transitions and invariant checks
- `validators.ts`: input validation and semantic guards
- `IssueRepository.ts`: persistence and transactional writes
- `IssueQueryRepository.ts`: list/detail query projection logic
- `schemas.ts`: Zod schemas for route inputs and outputs
- `handlers.ts`: request handlers used by App Router route files

## 5.2 Change-governance module

```text
src/modules/change-governance/domain/types.ts
src/modules/change-governance/application/linkChangeToIssue.ts
src/modules/change-governance/application/createIssueForHighRiskChangeIfNeeded.ts
src/modules/change-governance/application/syncChangeGovernanceStateToIssue.ts
src/modules/change-governance/infrastructure/ChangeRepositoryAdapter.ts
src/modules/change-governance/infrastructure/ApprovalRepositoryAdapter.ts
src/modules/change-governance/infrastructure/EvidenceRepositoryAdapter.ts
src/modules/change-governance/api/handlers.ts
src/modules/change-governance/index.ts
```

### Responsibilities
Wrap existing `src/services/changes`, `src/services/changeValidation`, `src/services/approvals`, and `src/services/evidence` behaviors.

## 5.3 Execution module

```text
src/modules/execution/domain/types.ts
src/modules/execution/application/deriveIssueOwner.ts
src/modules/execution/application/applyRoutingRules.ts
src/modules/execution/application/createExecutionTask.ts
src/modules/execution/application/recordExternalActionResult.ts
src/modules/execution/infrastructure/RoutingRuleRepository.ts
src/modules/execution/infrastructure/ExecutionTaskRepository.ts
src/modules/execution/api/handlers.ts
src/modules/execution/index.ts
```

## 5.4 Verification module

```text
src/modules/verification/domain/types.ts
src/modules/verification/application/initializeVerificationPolicy.ts
src/modules/verification/application/scheduleVerificationAfterResolution.ts
src/modules/verification/application/recordVerificationOutcome.ts
src/modules/verification/infrastructure/VerificationRepository.ts
src/modules/verification/api/handlers.ts
src/modules/verification/index.ts
```

## 5.5 Impact module

```text
src/modules/impact/domain/types.ts
src/modules/impact/application/attachPlaceholderImpact.ts
src/modules/impact/application/recalculateIssueImpact.ts
src/modules/impact/infrastructure/ImpactRepository.ts
src/modules/impact/api/handlers.ts
src/modules/impact/index.ts
```

## 5.6 Reporting module

```text
src/modules/reporting/application/getIssueExecutiveSummary.ts
src/modules/reporting/application/getIssueOpsSummary.ts
src/modules/reporting/infrastructure/ReportingQueryRepository.ts
src/modules/reporting/api/handlers.ts
src/modules/reporting/index.ts
```

---

# 6. Database build plan

Current migrations run through `134_organizations_enterprise_fields.sql`. Begin Phase 0 schema work at `135_*`.

## 6.1 Migration sequence

Create these migration files:

1. `135_phase0_issue_core.sql`
2. `136_phase0_issue_links_and_history.sql`
3. `137_phase0_verification_foundation.sql`
4. `138_phase0_impact_foundation.sql`
5. `139_phase0_execution_routing_foundation.sql`
6. `140_phase0_change_issue_links.sql`
7. `141_phase0_issue_rls.sql`
8. `142_phase0_issue_backfill.sql`

## 6.2 Migration 135 — issue core

Create enums:
- `issue_source_type`
- `issue_severity`
- `issue_status`
- `issue_verification_status`

Create table `issues`:

```sql
create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  issue_key text not null,
  source_type public.issue_source_type not null,
  source_ref text not null,
  source_event_time timestamptz null,
  domain_key text not null,
  title text not null,
  description text null,
  summary text null,
  severity public.issue_severity not null default 'medium',
  status public.issue_status not null default 'open',
  verification_status public.issue_verification_status not null default 'pending',
  priority_score numeric(8,2) null,
  impact_score numeric(8,2) null,
  confidence_score numeric(5,2) null,
  owner_user_id uuid null references auth.users(id),
  owner_team_key text null,
  sla_policy_key text null,
  opened_at timestamptz not null default now(),
  triaged_at timestamptz null,
  assigned_at timestamptz null,
  in_progress_at timestamptz null,
  resolved_at timestamptz null,
  verified_at timestamptz null,
  dismissed_at timestamptz null,
  closed_reason text null,
  reopen_count integer not null default 0,
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (org_id, issue_key)
);
```

Create indexes:

```sql
create index if not exists idx_issues_org_status on public.issues(org_id, status);
create index if not exists idx_issues_org_severity on public.issues(org_id, severity);
create index if not exists idx_issues_org_source on public.issues(org_id, source_type);
create index if not exists idx_issues_org_domain on public.issues(org_id, domain_key);
create index if not exists idx_issues_org_verification on public.issues(org_id, verification_status);
create index if not exists idx_issues_org_priority_desc on public.issues(org_id, priority_score desc nulls last);
```

### Issue key generation
Do not use a database sequence shared across orgs unless one already exists in repo conventions. Preferred approach:
- maintain an `org_counters` table if present, or
- create `issue_sequences(org_id uuid primary key, next_value bigint not null)` and increment transactionally
- format as `ISS-000001`

## 6.3 Migration 136 — links and history

Create:
- `issue_sources`
- `issue_entities`
- `issue_history`
- `issue_actions`
- `issue_comments`

Recommended `issue_history.event_type` values:
- `created`
- `triaged`
- `assigned`
- `started`
- `resolved`
- `verified`
- `dismissed`
- `reopened`
- `owner_changed`
- `action_created`
- `comment_added`
- `change_linked`
- `impact_attached`
- `verification_status_changed`

## 6.4 Migration 137 — verification foundation

Create `verification_runs` and `verification_evidence`.

Recommended enum values:
- `verification_type`: `rule_recheck`, `integration_probe`, `manual_attestation`, `metric_delta`
- `verification_run_status`: `pending`, `running`, `passed`, `failed`, `waived`

## 6.5 Migration 138 — impact foundation

Create `impact_assessments` with one-to-many history allowed. The active assessment is the latest by `calculated_at` unless an explicit active flag pattern already exists in the repo.

## 6.6 Migration 139 — execution routing foundation

Create `routing_rules` and `execution_tasks`.

Recommended execution statuses:
- `pending`
- `queued`
- `synced`
- `in_progress`
- `done`
- `failed`
- `canceled`

## 6.7 Migration 140 — change issue links

Create `change_issue_links`:

```sql
create table if not exists public.change_issue_links (
  id uuid primary key default gen_random_uuid(),
  change_id uuid not null,
  issue_id uuid not null references public.issues(id) on delete cascade,
  link_type text not null check (link_type in ('origin','related','caused','mitigates','blocked_by')),
  created_at timestamptz not null default now(),
  unique (change_id, issue_id, link_type)
);
```

Use the actual existing change table key in the repo. If the current change table uses a different PK type, adapt accordingly.

## 6.8 Migration 141 — RLS

Mirror the existing organization membership model already used throughout Supabase. Issue records must be org-scoped and role-aware.

At minimum:
- org members can read issues for their org
- only permitted roles can mutate lifecycle or actions
- executive dashboards may aggregate all org issues subject to role
- comment visibility supports internal or restricted values

## 6.9 Migration 142 — backfill

Backfill only these classes initially:
- unresolved incidents
- submitted or unresolved high-risk changes
- changes blocked on approvals/evidence with live risk posture

Do not backfill:
- resolved low-risk historical changes
- stale notifications without real ownership
- legacy records with no current operational value

Tag backfilled rows with metadata in `issue_sources.evidence_json`:

```json
{
  "backfilled": true,
  "backfillVersion": "phase0-v1",
  "sourceReason": "high_risk_change_unresolved"
}
```

---

# 7. TypeScript types and schemas

## 7.1 Canonical issue types

Create `src/modules/issues/domain/types.ts`:

```ts
export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IssueStatus = 'open' | 'triaged' | 'assigned' | 'in_progress' | 'resolved' | 'verified' | 'dismissed';
export type VerificationStatus = 'pending' | 'passed' | 'failed' | 'not_required';
export type IssueSourceType = 'change' | 'detector' | 'integration_event' | 'incident' | 'manual' | 'system_health' | 'verification_failure';

export interface IssueImpactSnapshot {
  revenueAtRisk: number | null;
  directRevenueLoss: number | null;
  customerCountAffected: number | null;
  operationalCostEstimate: number | null;
  confidenceScore: number | null;
  modelKey: string | null;
  modelVersion: string | null;
  impactUnknown: boolean;
}

export interface IssueOwner {
  userId: string | null;
  teamKey: string | null;
}

export interface IssueLinkSummary {
  changes: Array<{ changeId: string; linkType: string }>;
  entities: Array<{ entityType: string; externalSystem: string; externalId: string; displayName?: string | null }>;
  tasks: Array<{ taskId: string; externalSystem: string | null; status: string }>;
}

export interface IssueRecord {
  id: string;
  orgId: string;
  issueKey: string;
  sourceType: IssueSourceType;
  sourceRef: string;
  sourceEventTime: string | null;
  domainKey: string;
  title: string;
  description: string | null;
  summary: string | null;
  severity: IssueSeverity;
  status: IssueStatus;
  verificationStatus: VerificationStatus;
  priorityScore: number | null;
  impactScore: number | null;
  confidenceScore: number | null;
  owner: IssueOwner;
  slaPolicyKey: string | null;
  openedAt: string;
  triagedAt: string | null;
  assignedAt: string | null;
  inProgressAt: string | null;
  resolvedAt: string | null;
  verifiedAt: string | null;
  dismissedAt: string | null;
  closedReason: string | null;
  reopenCount: number;
  updatedAt: string;
}
```

## 7.2 API schemas

Create `src/modules/issues/api/schemas.ts` with Zod request and response schemas.

Required request schemas:
- `CreateIssueFromSourceSchema`
- `TriageIssueSchema`
- `AssignIssueSchema`
- `StartIssueSchema`
- `ResolveIssueSchema`
- `DismissIssueSchema`
- `ReopenIssueSchema`
- `AddIssueCommentSchema`
- `ListIssuesQuerySchema`

### CreateIssueFromSourceSchema

```ts
{
  sourceType: enum,
  sourceRef: string,
  sourceEventTime?: string,
  domainKey: string,
  title: string,
  description?: string,
  summary?: string,
  severity?: enum,
  confidenceScore?: number,
  sourceEvidence?: Record<string, unknown>,
  entities?: Array<{
    entityType: string,
    externalSystem: string,
    externalObjectType?: string,
    externalId: string,
    entityDisplayName?: string,
    metadata?: Record<string, unknown>
  }>,
  links?: {
    changeIds?: string[]
  }
}
```

---

# 8. API surface to build

Implement these App Router routes under `src/app/api/issues`.

## 8.1 Routes

```text
src/app/api/issues/route.ts                      // GET list, POST create/from-source
src/app/api/issues/[issueId]/route.ts           // GET detail
src/app/api/issues/[issueId]/history/route.ts   // GET history
src/app/api/issues/[issueId]/actions/route.ts   // GET, POST action
src/app/api/issues/[issueId]/comments/route.ts  // POST comment
src/app/api/issues/[issueId]/triage/route.ts    // POST
src/app/api/issues/[issueId]/assign/route.ts    // POST
src/app/api/issues/[issueId]/start/route.ts     // POST
src/app/api/issues/[issueId]/resolve/route.ts   // POST
src/app/api/issues/[issueId]/dismiss/route.ts   // POST
src/app/api/issues/[issueId]/reopen/route.ts    // POST
src/app/api/issues/[issueId]/verification/route.ts      // GET
src/app/api/issues/[issueId]/verification/run/route.ts  // POST
src/app/api/issues/[issueId]/verification/attest/route.ts // POST
```

## 8.2 Handler design

Each route file should be thin and call module handlers.

Pattern:
- authenticate user
- resolve org context using existing org-access utilities
- parse with Zod schema
- call module application service
- map domain result into API response shape
- emit audit + telemetry

## 8.3 Response contract

Issue detail response must always include:
- core issue record
- active impact snapshot or `impactUnknown`
- link summaries
- latest verification summary
- current owner and SLA posture

---

# 9. Existing code mapping

Use the current repository layout to reduce implementation churn.

## 9.1 Move by wrapping, not by deleting

### Wrap into `change-governance`
- `src/services/changes/*`
- `src/services/changeValidation/*`
- `src/services/approvals/*`
- `src/services/evidence/*`
- `src/lib/changes/*`
- `src/lib/governance/*`

### Wrap into `issues`
- current issue-like semantics spread across `src/services/risk/*`
- current incident linkage logic under `src/components/incidents` and any related service layer
- current timeline history logic in `src/services/timeline/*`
- current audit adapters in `src/lib/audit.ts`

### Wrap into `execution`
- `src/services/jira/*`
- `src/services/slack/*`
- notification-oriented logic in `src/services/notifications/*`
- coordination flows in `src/services/coordination/*`

### Wrap into `impact`
- `src/services/revenue/*`
- `src/services/revenueImpact/*`
- issue-facing metrics logic under `src/lib/metrics/*` where applicable

### Wrap into `verification`
- readiness checks in `src/lib/ready-status.ts`
- evidence completeness checks that can act as provisional verification signals

### Keep in place for now
- auth, billing, orgs, invites, SSO, and generalized UI primitives

---

# 10. UI implementation plan

Phase 0 is not a visual redesign. It is an information architecture correction.

## 10.1 Primary navigation changes

Update the app shell so the primary operational nav includes:
- Issues
- Integrations
- Changes
- Incidents
- Executive
- Settings

Do not remove current change-related entry points. Reorder them so Issues is the center of gravity.

## 10.2 New Issues index page

Create route:
- `src/app/(app)/issues/page.tsx`

Create components:

```text
src/components/issues/IssuesPageShell.tsx
src/components/issues/IssuesTable.tsx
src/components/issues/IssuesFilters.tsx
src/components/issues/IssueStatusTabs.tsx
src/components/issues/IssuePriorityBadge.tsx
src/components/issues/IssueSourceBadge.tsx
src/components/issues/IssueVerificationBadge.tsx
src/components/issues/IssueSavedViews.tsx
```

### Required UX
- tabs: Open, Assigned, Pending Verification, Verified, Dismissed
- filters: source type, domain, severity, owner, verification status, date range
- sort: priority, severity, revenue at risk, age, updated, SLA due
- saved views for Exec, RevOps, Engineering, My Queue
- row click opens issue detail

## 10.3 New Issue detail page

Create route:
- `src/app/(app)/issues/[issueId]/page.tsx`

Create components:

```text
src/components/issues/IssueDetailHeader.tsx
src/components/issues/IssueImpactCard.tsx
src/components/issues/IssueEvidencePanel.tsx
src/components/issues/IssueSourcePanel.tsx
src/components/issues/IssueLinksPanel.tsx
src/components/issues/IssueActionsPanel.tsx
src/components/issues/IssueTimelinePanel.tsx
src/components/issues/IssueVerificationPanel.tsx
src/components/issues/IssueCommentsPanel.tsx
src/components/issues/IssueOwnerPanel.tsx
```

### Required UX sections
1. Header with issue key, title, severity, status, verification, owner
2. Impact card with placeholder model and assumptions
3. Evidence/source panel showing source type, source ref, and attached evidence
4. Linked entities and linked changes
5. Actions/tasks and external artifacts
6. Timeline/history
7. Verification panel
8. Comments/internal collaboration

## 10.4 Change detail page updates

On existing change detail views, add:
- Linked Issues card
- Create/Link Issue action if no issue exists
- Issue lineage section showing whether the change originated, mitigates, or is blocked by issues

Target components likely near:
- `src/components/ChangeAssessmentPanel.tsx`
- `src/components/ApprovalsPanel.tsx`
- `src/components/EvidencePanel.tsx`
- `src/components/DeliveryPanel.tsx`

Do not force a redesign. Add issue-context side panels and summary banners.

## 10.5 Executive dashboard updates

Add issue-based cards to executive surfaces:
- Open revenue at risk
- Critical unresolved issues
- Resolved pending verification
- Verified wins in last 30 days
- Reopened after failed verification
- Top issue sources

Likely landing zone:
- `src/components/executive/*`
- `src/app/for-executives/*`
- any executive dashboard route under `src/app/(app)`

---

# 11. Query design

## 11.1 Issue list projection

Create a dedicated query repository rather than building issue list pages from raw table joins in route handlers.

`IssueListItem` shape:

```ts
interface IssueListItem {
  id: string;
  issueKey: string;
  title: string;
  sourceType: string;
  domainKey: string;
  severity: string;
  status: string;
  verificationStatus: string;
  priorityScore: number | null;
  revenueAtRisk: number | null;
  ownerDisplay: string | null;
  linkedChangeCount: number;
  ageHours: number;
  updatedAt: string;
}
```

## 11.2 Issue detail projection

Do not assemble issue detail with multiple client round trips. Return a composed payload from one server-side query path.

Recommended sources:
- `issues`
- latest `impact_assessments`
- `change_issue_links`
- `issue_entities`
- `issue_actions`
- `issue_comments`
- `issue_history`
- latest `verification_runs`

---

# 12. Backfill implementation logic

Create a server-side script or admin route under the existing script/admin conventions.

Suggested locations:
- `scripts/backfill-phase0-issues.ts`
- or an admin-only route under `src/app/api/admin/backfill/issues/route.ts`

## 12.1 Backfill rules

### Rule A — unresolved incidents
If an incident is unresolved and not already linked to an issue, create an issue:
- `source_type = 'incident'`
- `source_ref = incident.id`
- `status = 'open'` or `triaged` depending on incident maturity

### Rule B — high-risk unresolved changes
If a change is submitted or unresolved, marked high-risk, and not already linked to an issue, create an issue:
- `source_type = 'change'`
- `source_ref = change.id`
- `link_type = 'origin'`

### Rule C — governance blocker changes
If a change is blocked on approvals or required evidence and is still active, create issue:
- title format: `High-risk change blocked by governance requirements`
- severity based on existing change risk score or readiness status

## 12.2 Backfill safeguards
- dry-run mode required
- emit row-by-row summary JSON
- enforce idempotency by checking existing `change_issue_links` or `issue_sources`
- cap first production run by org or by record count

---

# 13. Audit and telemetry implementation

Use existing `src/lib/audit.ts` and observability utilities as adapters, but the event catalog must become issue-centric.

## 13.1 Required telemetry events
- `issue_created`
- `issue_triaged`
- `issue_assigned`
- `issue_started`
- `issue_resolved`
- `issue_verified`
- `issue_reopened`
- `issue_dismissed`
- `issue_comment_added`
- `issue_action_created`
- `change_linked_to_issue`
- `verification_run_started`
- `verification_run_completed`
- `routing_rule_applied`

## 13.2 Required metadata
- `org_id`
- `issue_id`
- `issue_key`
- `source_type`
- `domain_key`
- `actor_type`
- `actor_ref`
- `request_id` if available

## 13.3 Audit rule
Every successful issue lifecycle transition must write:
1. domain-level history row in `issue_history`
2. audit log entry through existing audit utility
3. telemetry event

---

# 14. Search implementation

Existing repo already has search investments under `src/services/search`, `src/components/search`, and public docs index artifacts. Phase 0 must make issues searchable as first-class application objects.

## 14.1 Search document fields
Index these fields for issues:
- issue key
- title
- summary
- description
- source type
- source ref
- domain
- severity
- status
- verification status
- owner
- linked change ids
- linked external entity display names and IDs
- top-line impact values

## 14.2 Search UI behavior
Global search should return issue records with badges for:
- severity
- status
- source type

Target landing zones:
- `src/components/search/*`
- existing app-wide command bar or search entry points if present

---

# 15. Detailed API behavior

## 15.1 POST `/api/issues`
Create a manual issue.

Required permissions:
- org member with issue create permission

Behavior:
- validate payload
- create issue
- create `issue_sources` row with `source_type = 'manual'`
- attach placeholder impact
- append history event `created`
- return full detail payload

## 15.2 POST `/api/issues/from-source`
This may be implemented initially as part of `POST /api/issues` with a source payload, but keep the handler modular. Used by change-governance and future detectors.

Behavior:
- validate source contract
- dedupe by source type and source ref if policy says one active issue per source
- create issue and source rows
- link change if change IDs present
- initialize verification placeholder
- attach placeholder impact

## 15.3 POST `/api/issues/:issueId/triage`
Payload:
- domainKey optional if not already set
- severity optional override
- priorityScore optional
- summary optional

Guards:
- issue must be `open`

Effects:
- transition to `triaged`
- set `triaged_at`
- append history
- emit telemetry

## 15.4 POST `/api/issues/:issueId/assign`
Payload:
- `ownerUserId?: string`
- `ownerTeamKey?: string`
- `routingRationale?: string`

Guards:
- issue must be `triaged` or `open` if product wants fast-path assignment
- at least one owner field required

Effects:
- apply routing fields
- set `assigned_at`
- append history

## 15.5 POST `/api/issues/:issueId/start`
Effects:
- move to `in_progress`
- stamp time
- optionally create default execution task if requested

## 15.6 POST `/api/issues/:issueId/resolve`
Payload:
- `resolutionSummary: string`
- `verificationType: 'rule_recheck' | 'integration_probe' | 'manual_attestation' | 'metric_delta'`
- `waiveVerification?: boolean`

Guards:
- issue must be `in_progress` unless policy allows `assigned`
- resolution summary required

Effects:
- move to `resolved`
- initialize or schedule verification
- append history

## 15.7 POST `/api/issues/:issueId/dismiss`
Payload:
- `reason: 'duplicate' | 'false_positive' | 'accepted_risk' | 'obsolete'`
- `notes?: string`

Effects:
- move to `dismissed`
- record `closed_reason`

## 15.8 POST `/api/issues/:issueId/reopen`
Payload:
- `reason: string`

Effects:
- move to `open`
- increment `reopen_count`
- set `verification_status = 'failed'` if cause is verification failure

---

# 16. Role and permissions requirements

Leverage the repo’s existing org and RBAC machinery. Do not invent a separate auth model.

## Required permission groups

### Viewers
Can read issues in their org according to visibility.

### Operators / RevOps
Can triage, assign, comment, and resolve.

### Engineering / IT
Can start work, resolve, comment, and inspect technical evidence.

### Executives
Can view all issues and dashboards but do not need mutation permissions by default.

### Admins
Can do all lifecycle mutations including dismiss/reopen and policy configuration.

## Permission checks
Add issue-level policy helpers in:
- `src/modules/org-access/application/*`
- or existing `src/lib/rbac/*` as adapters until fully modularized

---

# 17. Testing pack

## 17.1 Unit tests
Create tests for:
- state machine valid transitions
- state machine invalid transitions
- issue creation from source payload
- backfill dedupe logic
- change-to-issue linking
- assign owner guards
- resolve requiring summary
- reopen increments count and updates verification status

Suggested locations:
- `src/modules/issues/domain/__tests__/*`
- `src/modules/issues/application/__tests__/*`
- `src/modules/change-governance/application/__tests__/*`

## 17.2 Integration tests
Create tests for:
- `GET /api/issues`
- `GET /api/issues/:issueId`
- lifecycle mutation routes
- RLS behavior across orgs
- linked change surfaces
- latest impact and verification projection behavior

## 17.3 E2E tests
Using the repo’s Playwright setup, add flows for:
1. backfilled high-risk change appears in Issues index
2. operator triages and assigns issue
3. engineer starts and resolves issue
4. verification run is created
5. issue appears in executive summary counts

---

# 18. Product and design handoff requirements

## 18.1 Product must define
Before coding finishes, product must provide:
- domain key taxonomy for issue grouping
- initial severity guidance
- initial owner team keys
- reasons allowed for dismissal
- initial saved views for each persona
- backfill eligibility rules by org if needed

## 18.2 Design must provide
Design should deliver:
- updated left-nav hierarchy
- issues index layout
- issue detail hierarchy
- linked issue cards for change detail pages
- updated executive cards for issue-based metrics

The design goal is clarity, not reinvention.

---

# 19. Delivery sequencing

## Wave 1 — schema and module skeletons
- migrations 135–141
- module folders and core types
- issue repository/query repository
- issue state machine tests

## Wave 2 — API and backfill
- issue route handlers
- change-governance adapter use cases
- backfill script in dry run and live mode

## Wave 3 — UI and reporting
- Issues index page
- Issue detail page
- linked issue surfaces on change pages
- executive issue cards

## Wave 4 — hardening
- RLS validation
- telemetry and audit validation
- search indexing
- E2E coverage

---

# 20. Risks and mitigations

## Risk 1: accidental duplicate models
Mitigation: require all new workflows to open a design review against the issue model before implementation.

## Risk 2: over-backfilling noise
Mitigation: dry-run and explicit eligibility rules.

## Risk 3: breaking current change flows
Mitigation: wrappers around legacy services; do not rewrite all change pages in Phase 0.

## Risk 4: route sprawl and inconsistent contracts
Mitigation: all issue routes must delegate to module handlers and use shared Zod schemas.

## Risk 5: reporting inconsistencies during migration
Mitigation: executive views should clearly label issue-backed cards and keep legacy cards temporarily until parity is proven.

---

# 21. Final build checklist

Engineering can use this as the final implementation list.

## Schema
- [ ] Create migrations 135–142
- [ ] Apply RLS for issue tables
- [ ] Implement issue key generation

## Modules
- [ ] Scaffold issues module
- [ ] Scaffold change-governance module
- [ ] Scaffold execution module
- [ ] Scaffold verification module
- [ ] Scaffold impact module
- [ ] Scaffold reporting module

## APIs
- [ ] Implement issue list/detail/create routes
- [ ] Implement lifecycle mutation routes
- [ ] Implement verification routes
- [ ] Add route tests

## Backfill
- [ ] Build dry-run script
- [ ] Backfill unresolved incidents
- [ ] Backfill high-risk active changes
- [ ] Validate dedupe and lineage

## UI
- [ ] Add Issues nav entry
- [ ] Ship Issues index
- [ ] Ship Issue detail
- [ ] Add linked issues to change detail pages
- [ ] Add issue-based executive cards

## Reporting and search
- [ ] Add issue search indexing
- [ ] Add issue-based executive summary query
- [ ] Add ops summary query

## Hardening
- [ ] Telemetry and audit instrumentation
- [ ] RLS verification
- [ ] Playwright E2E flows

---

# 22. Definition of done for moving to Phase 1

You are ready for Phase 1 when these conditions are met:

1. Integrations can target the issue object without inventing a new model.
2. Existing change workflows are still working and now produce or link issues.
3. Product can demo Solvren as an issue-centric platform rather than a change-only tool.
4. Executive and operations users can both navigate and understand issue-based views.
5. The codebase has clean enough boundaries to deepen integration work safely.

At that point, Phase 1 can focus on the integration platform itself: connector contracts, auth health, sync health, action capabilities, monitoring coverage, and the first truly dependable integration control center.
