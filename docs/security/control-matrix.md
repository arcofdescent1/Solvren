# Security control matrix (SOC-ready)

**Purpose:** Map Solvren operations to defined controls with owners, evidence, and failure handling. This is an **internal** control framework — not a formal attestation.

**Principle:** Every control has an owner and a primary evidence source. See [`security-ownership.md`](security-ownership.md).

**Related:** Policies in [`policies/`](policies/); runbooks: [`access-review-process.md`](access-review-process.md), [`change-management-runbook.md`](change-management-runbook.md), [`incident-response-runbook.md`](incident-response-runbook.md).

---

## Legend

| Field | Meaning |
|-------|---------|
| **Owner** | Role/person accountable (see security-ownership) |
| **Evidence** | Where to prove operation of the control |
| **Cadence** | How often evidence or review is refreshed |
| **Failure response** | What to do when the control breaks or is bypassed |

---

## Access control

| ID | Control name | Objective |
|----|----------------|-----------|
| **AC-01** | Authenticated access required | Only identified users access the application and APIs that require identity. |
| **AC-02** | Org-scoped authorization | Users cannot act outside organizations they belong to. |
| **AC-03** | RBAC enforced | Permissions follow defined roles; sensitive actions require explicit permission. |
| **AC-04** | Privileged access limited | Elevated DB/API paths are rare, justified, and audited. |
| **AC-05** | Service-role usage controlled | Service role is used only from server contexts with documented reasons. |
| **AC-06** | Production platform access limited | Only approved personnel have admin/production access to Vercel, Supabase, GitHub, etc. |

### AC-01 — Authenticated access required

| Field | Detail |
|-------|--------|
| **Implementation** | Supabase Auth; server routes use `requireVerifiedUser` / session validation per [`security-phase0.md`](../security-phase0.md). |
| **Technical owner** | Engineering Lead (Auth) |
| **Evidence source** | Code review of `src/lib/server/authz.ts`, middleware; integration tests with RLS where applicable (`docs/security/integration-tests.md`). |
| **Review cadence** | Quarterly sample review of new API routes; ad hoc on auth changes. |
| **Failure response** | Disable affected route or feature; hotfix via change management; document in incident process if customer-impacting. |

### AC-02 — Org-scoped authorization

| Field | Detail |
|-------|--------|
| **Implementation** | `requireOrgPermission`, `resolveResourceInOrg`; Postgres RLS with `is_org_member` / org-scoped policies. |
| **Technical owner** | Engineering Lead (RLS / Data isolation) |
| **Evidence source** | RLS migrations in repo; `RUN_INTEGRATION_TESTS=1` two-org tests; audit log samples. |
| **Review cadence** | Each PR touching org-scoped tables; quarterly policy spot-check. |
| **Failure response** | Emergency patch + RLS verification; customer notification if cross-tenant risk (SEV-1). |

### AC-03 — RBAC enforced

| Field | Detail |
|-------|--------|
| **Implementation** | `src/lib/rbac/permissions.ts`, `hasPermissionInOrg`, route-level checks. |
| **Technical owner** | Engineering Lead (Auth) |
| **Evidence source** | Permission matrix in code; PR checklist in [`secure-sdlc.md`](secure-sdlc.md). |
| **Review cadence** | On role/permission changes. |
| **Failure response** | Revert or patch; audit who could have been affected; access review if misuse suspected. |

### AC-04 — Privileged access limited

| Field | Detail |
|-------|--------|
| **Implementation** | `createPrivilegedClient(reason)`; admin API routes gated by permissions. |
| **Technical owner** | Engineering Lead (Privileged boundary) |
| **Evidence source** | `docs/service-role-inventory.md` (or equivalent); audit actions for privileged operations. |
| **Review cadence** | Quarterly inventory vs code. |
| **Failure response** | Revoke keys if leaked; rotate secrets; incident runbook. |

### AC-05 — Service-role usage controlled

| Field | Detail |
|-------|--------|
| **Implementation** | Service role only in server code; never `NEXT_PUBLIC_*`; cron/background jobs authenticated (`CRON_SECRET` etc.). |
| **Technical owner** | Engineering Lead (Privileged boundary) |
| **Evidence source** | Env validation (`instrumentation.ts`); grep / review; Vercel env scoping. |
| **Review cadence** | Quarterly. |
| **Failure response** | Rotate Supabase service key; review Vercel env exposure. |

### AC-06 — Production platform access limited

| Field | Detail |
|-------|--------|
| **Implementation** | Least-privilege accounts on Vercel, Supabase, GitHub; MFA where supported. |
| **Technical owner** | Operations Owner |
| **Evidence source** | Monthly access review records in `evidence/access-reviews/`. |
| **Review cadence** | Monthly (see [`access-review-process.md`](access-review-process.md)). |
| **Failure response** | Immediate removal of unused access; document in access review file. |

---

## Change management

| ID | Control name | Objective |
|----|----------------|-----------|
| **CM-01** | Production code changes reviewed | No unreviewed code ships to production. |
| **CM-02** | Changes traceable to PR/commit | Every deploy maps to version control history. |
| **CM-03** | Migrations versioned and reviewed | Schema changes are SQL migrations, reviewed, and environment-tested. |
| **CM-04** | Rollback path for critical releases | Critical releases have a documented rollback or mitigation plan. |

### CM-01 — Production code changes reviewed

| Field | Detail |
|-------|--------|
| **Implementation** | GitHub branch protection (PR required, approvals); see [`change-management-runbook.md`](change-management-runbook.md). |
| **Technical owner** | Engineering Lead |
| **Evidence source** | GitHub branch protection screenshot/export in `evidence/configuration/`; PR history. |
| **Review cadence** | Quarterly config check. |
| **Failure response** | Reinstate protection; retroactively document any bypass. |

### CM-02 — Traceable to PR/commit

| Field | Detail |
|-------|--------|
| **Implementation** | Vercel (or host) deploys tied to Git commits; [`evidence/releases/release-log.md`](evidence/releases/release-log.md). |
| **Technical owner** | Engineering Lead |
| **Evidence source** | Release log + Vercel/GitHub deploy UI. |
| **Review cadence** | Each release (log updated). |
| **Failure response** | Backfill log from deploy system; policy reminder. |

### CM-03 — Migrations versioned and reviewed

| Field | Detail |
|-------|--------|
| **Implementation** | Supabase migrations in repo; PR review; preview/dev before prod. |
| **Technical owner** | Engineering Lead (RLS / Data isolation) |
| **Evidence source** | Migration files + merged PRs; release log notes migrations. |
| **Review cadence** | Per migration PR. |
| **Failure response** | Follow rollback/mitigation in runbook; incident if data loss risk. |

### CM-04 — Rollback path

| Field | Detail |
|-------|--------|
| **Implementation** | Documented in change-management runbook; Vercel instant rollback where applicable. |
| **Technical owner** | Engineering Lead |
| **Evidence source** | Runbook; post-incident or release notes for exercised rollbacks. |
| **Review cadence** | Before major releases. |
| **Failure response** | Execute rollback; communicate per incident severity. |

---

## Logging and monitoring

| ID | Control name | Objective |
|----|----------------|-----------|
| **LM-01** | Security-relevant actions logged | Material security and admin actions leave an audit trail. |
| **LM-02** | Errors monitored | Production errors are visible and triaged. |
| **LM-03** | Alert channels configured | Critical failures notify responsible parties. |
| **LM-04** | Privileged actions auditable | Service-role and admin mutations can be attributed and reviewed. |

### LM-01 — Security-relevant actions logged

| Field | Detail |
|-------|--------|
| **Implementation** | `audit_log` / `auditLog` / `auditLogStrict`; action catalog in `src/lib/audit/actions.ts`. |
| **Technical owner** | Engineering Lead (Audit logging) |
| **Evidence source** | DB samples (redacted); Sentry/config without secrets. |
| **Review cadence** | Quarterly sampling. |
| **Failure response** | Fix logging gap; never log secrets (see data-handling policy). |

### LM-02 — Errors monitored

| Field | Detail |
|-------|--------|
| **Implementation** | Sentry (or equivalent) for Next.js server/client errors. |
| **Technical owner** | Engineering Lead (Monitoring) |
| **Evidence source** | Sentry project settings + alert rules export/screenshot in `evidence/configuration/`. |
| **Review cadence** | Quarterly. |
| **Failure response** | Tune alerts; on-call response per incident model. |

### LM-03 — Alert channels

| Field | Detail |
|-------|--------|
| **Implementation** | Pager/on-call or Slack/email routing documented in incident runbook. |
| **Technical owner** | Operations Owner |
| **Evidence source** | `evidence/monitoring/` alert test records. |
| **Review cadence** | Semi-annual alert test. |
| **Failure response** | Update routing; document outage of alerting as incident if prolonged. |

### LM-04 — Privileged actions auditable

| Field | Detail |
|-------|--------|
| **Implementation** | Privileged client calls paired with audit metadata where applicable. |
| **Technical owner** | Engineering Lead (Audit logging) |
| **Evidence source** | Audit queries + service-role inventory. |
| **Review cadence** | Quarterly. |
| **Failure response** | Add audit coverage in follow-up PR. |

---

## Data protection

| ID | Control name | Objective |
|----|----------------|-----------|
| **DP-01** | Encryption in transit | Customer data moves over TLS between clients and Solvren/backends. |
| **DP-02** | Encryption at rest | Data store encryption per platform (e.g., Supabase). |
| **DP-03** | Integration secrets encrypted | Third-party tokens/secrets stored with application-layer encryption. |
| **DP-04** | Tenant isolation through RLS | Database policies enforce org boundaries. |

### DP-01 — Encryption in transit

| Field | Detail |
|-------|--------|
| **Implementation** | HTTPS; HSTS and related headers in `next.config.ts` (production). |
| **Technical owner** | Engineering Lead (Auth) |
| **Evidence source** | Header config in repo; hosting TLS (Vercel default). |
| **Review cadence** | Annual + on hosting change. |
| **Failure response** | Fix misconfiguration immediately; document if customer-visible. |

### DP-02 — Encryption at rest

| Field | Detail |
|-------|--------|
| **Implementation** | Managed database encryption via Supabase/cloud provider. |
| **Technical owner** | Operations Owner |
| **Evidence source** | Supabase/vendor documentation link in [`vendor-inventory.md`](vendor-inventory.md). |
| **Review cadence** | Annual vendor review. |
| **Failure response** | Engage vendor support; assess breach procedures if failure implies exposure. |

### DP-03 — Integration secrets encrypted

| Field | Detail |
|-------|--------|
| **Implementation** | `src/lib/server/crypto.ts`, integration sealing; key rotation: [`encryption-key-rotation.md`](encryption-key-rotation.md). |
| **Technical owner** | Engineering Lead (Integration secrets) |
| **Evidence source** | Code review; env `ENCRYPTION_KEY` / `ENCRYPTION_KEY_PREVIOUS` governance. |
| **Review cadence** | On crypto changes; annual policy review. |
| **Failure response** | Rotate keys; re-seal credentials; incident if keys compromised. |

### DP-04 — Tenant isolation (RLS)

| Field | Detail |
|-------|--------|
| **Implementation** | Postgres RLS; see Phase 0 doc. |
| **Technical owner** | Engineering Lead (RLS / Data isolation) |
| **Evidence source** | Migrations; integration tests. |
| **Review cadence** | Per RLS-affecting PR. |
| **Failure response** | Emergency migration + verification; SEV-1 if cross-tenant possible. |

---

## Availability and recovery

| ID | Control name | Objective |
|----|----------------|-----------|
| **AR-01** | Backups configured | Data can be recovered from backup. |
| **AR-02** | Restore tested | Restore procedure is exercised on a schedule. |
| **AR-03** | Retention jobs operational | Lifecycle/retention automation runs and is observable. |
| **AR-04** | Health checks present | Liveness/readiness signals exist for production. |

### AR-01 — Backups configured

| Field | Detail |
|-------|--------|
| **Implementation** | Supabase backup strategy per plan; documented in [`backup-recovery.md`](backup-recovery.md). |
| **Technical owner** | Operations Owner |
| **Evidence source** | Vendor console notes/screenshot in `evidence/configuration/`; policy [`policies/backup-recovery-policy.md`](policies/backup-recovery-policy.md). |
| **Review cadence** | Quarterly review with vendor settings. |
| **Failure response** | Escalate to vendor; communicate RTO/RPO impact. |

### AR-02 — Restore tested

| Field | Detail |
|-------|--------|
| **Implementation** | [`restore-test-checklist.md`](restore-test-checklist.md); evidence in `evidence/backups/`. |
| **Technical owner** | Operations Owner |
| **Evidence source** | Dated drill writeups in `evidence/backups/`. |
| **Review cadence** | At least annual (adjust per policy). |
| **Failure response** | Remediate gaps; update runbook. |

### AR-03 — Retention jobs operational

| Field | Detail |
|-------|--------|
| **Implementation** | Cron/data retention per Phase 0/1 docs (`data-retention`, soft-delete helpers). |
| **Technical owner** | Engineering Lead |
| **Evidence source** | Cron logs or monitoring checks in `evidence/monitoring/`. |
| **Review cadence** | Monthly job success check. |
| **Failure response** | Fix job; backlog processing plan; legal/privacy review if delays affect retention commitments. |

### AR-04 — Health checks

| Field | Detail |
|-------|--------|
| **Implementation** | Health/API routes used by hosting or synthetic checks. |
| **Technical owner** | Engineering Lead (Monitoring) |
| **Evidence source** | `evidence/monitoring/` validation records. |
| **Review cadence** | Quarterly. |
| **Failure response** | Restore service; incident if user-facing outage. |

---

## Incident response

| ID | Control name | Objective |
|----|----------------|-----------|
| **IR-01** | Incident severity model defined | Incidents are classified consistently. |
| **IR-02** | Response roles assigned | Someone owns triage and communication. |
| **IR-03** | Escalation process documented | Path to leadership and customers is clear. |
| **IR-04** | Post-incident review required | Material incidents produce lessons learned and actions. |

### IR-01 — Severity model

| Field | Detail |
|-------|--------|
| **Implementation** | [`incident-response-runbook.md`](incident-response-runbook.md) (SEV-1–4). |
| **Technical owner** | Incident Lead |
| **Evidence source** | Runbook + incident tickets in `evidence/incidents/`. |
| **Review cadence** | Annual tabletop. |
| **Failure response** | Retroactively assign severity; improve definitions. |

### IR-02 — Response roles

| Field | Detail |
|-------|--------|
| **Implementation** | Named roles in runbook and [`security-ownership.md`](security-ownership.md). |
| **Technical owner** | Incident Lead |
| **Evidence source** | Runbook; onboarding checklist for new responders. |
| **Review cadence** | On staffing change. |
| **Failure response** | Assign interim owner; update doc. |

### IR-03 — Escalation

| Field | Detail |
|-------|--------|
| **Implementation** | Documented in runbook and incident policy. |
| **Technical owner** | Incident Lead |
| **Evidence source** | Incident timelines in `evidence/incidents/`. |
| **Review cadence** | Per incident. |
| **Failure response** | Postmortem item: improve escalation. |

### IR-04 — Post-incident review

| Field | Detail |
|-------|--------|
| **Implementation** | Required for SEV-1/2 and as needed for SEV-3; template in evidence folder README. |
| **Technical owner** | Incident Lead |
| **Evidence source** | `evidence/incidents/YYYY-MM-DD-slug.md`. |
| **Review cadence** | Per qualifying incident. |
| **Failure response** | Complete postmortem within policy SLA. |

---

## Vendor and infrastructure trust

| ID | Control name | Objective |
|----|----------------|-----------|
| **VT-01** | Key vendors identified | Critical suppliers are known and owned. |
| **VT-02** | Subprocessors inventoried | Customer-facing list matches reality. |
| **VT-03** | Service dependencies documented | Architecture dependencies are written down. |
| **VT-04** | Production environment ownership documented | Who owns prod hosting, DB, DNS, secrets. |

### VT-01 — Key vendors

| Field | Detail |
|-------|--------|
| **Implementation** | [`vendor-inventory.md`](vendor-inventory.md) maintained by owner. |
| **Technical owner** | Vendor / Policy Owner |
| **Evidence source** | Vendor inventory file + annual review date. |
| **Review cadence** | Quarterly updates; annual deep review. |
| **Failure response** | Add new vendor before prod use where feasible; retro-document urgent adoptions. |

### VT-02 — Subprocessors

| Field | Detail |
|-------|--------|
| **Implementation** | [`subprocessors.md`](subprocessors.md) aligned with inventory. |
| **Technical owner** | Vendor / Policy Owner |
| **Evidence source** | Customer DPA/subprocessor page (when published) + internal inventory. |
| **Review cadence** | Quarterly. |
| **Failure response** | Notify customers if material subprocessor change per contract. |

### VT-03 — Dependencies documented

| Field | Detail |
|-------|--------|
| **Implementation** | Architecture/overview docs + vendor inventory “purpose” fields. |
| **Technical owner** | Engineering Lead |
| **Evidence source** | Repo docs; optional diagram in `evidence/configuration/`. |
| **Review cadence** | On major architecture change. |
| **Failure response** | Update docs in same PR as change. |

### VT-04 — Production ownership

| Field | Detail |
|-------|--------|
| **Implementation** | [`security-ownership.md`](security-ownership.md). |
| **Technical owner** | Founder / Admin or delegated Operations Owner |
| **Evidence source** | Ownership doc + org chart note. |
| **Review cadence** | Annual. |
| **Failure response** | Reassign and document. |

---

## Control ↔ policy index

| Policy | Primary controls |
|--------|------------------|
| [access-control-policy.md](policies/access-control-policy.md) | AC-* |
| [change-management-policy.md](policies/change-management-policy.md) | CM-* |
| [logging-monitoring-policy.md](policies/logging-monitoring-policy.md) | LM-* |
| [data-handling-policy.md](policies/data-handling-policy.md) | DP-* |
| [backup-recovery-policy.md](policies/backup-recovery-policy.md) | AR-01, AR-02 |
| [incident-response-policy.md](policies/incident-response-policy.md) | IR-* |
| [vendor-management-policy.md](policies/vendor-management-policy.md) | VT-* |

---

## Definition of done (matrix maintenance)

- [x] No control row lacks **Owner** and **Evidence source**.
- [ ] Quarterly: spot-check that evidence locations contain dated artifacts.
- [ ] After material architecture change: update VT-* and DP-* as needed.

---

## Phase 2 alignment

This matrix satisfies the SOC-ready Phase 2 control framework. All controls map to policies in [`policies/`](policies/) and evidence in [`evidence/`](evidence/).
