# Phase 0 — Module Boundaries

## Target Source Structure

```
src/modules/
  org-access/       domain, application, infrastructure, api, index.ts
  integrations/     domain, application, infrastructure, api, index.ts
  signals/          domain, application, infrastructure, api, index.ts
  detection/        domain, application, infrastructure, api, index.ts
  impact/           domain, application, infrastructure, api, index.ts
  issues/           domain, application, infrastructure, api, index.ts
  execution/        domain, application, infrastructure, api, index.ts
  verification/     domain, application, infrastructure, api, index.ts
  change-governance/ domain, application, infrastructure, api, index.ts
  reporting/        domain, application, infrastructure, api, index.ts
```

## Domain Responsibilities

- **org-access** — Membership, roles, invitations, RBAC, tenancy.
- **integration-platform** — Connector registration, auth status, sync state, webhook envelope, health.
- **signal-ingestion** — Raw event intake, normalization, idempotency, normalized signal persistence.
- **detection** — Detectors, evaluation, evidence, dedupe, issue creation requests.
- **impact** — Impact contracts, model versions, confidence, impact attachment to issues.
- **issues** — Issue CRUD, lifecycle, source linkage, triage, assignee, history, queries.
- **execution-routing** — Routing rules, owner derivation, task generation, external adapters, SLA, escalation.
- **verification** — Verification runs, evidence, pass/fail, re-open logic, verified outcome metrics.
- **change-governance** — Change intake, approvals, evidence, readiness, submit/review, links to issue lifecycle.
- **analytics-reporting** — Executive aggregation, saved views, search, reporting snapshots.

## Migration Policy

- `src/services` remains as legacy; no new business logic there after Phase 0.
- New code lands under `src/modules/*`.
- Existing services are wrapped or imported into module application services until migrated.
- UI may consume old APIs temporarily; new APIs must be module-owned.
