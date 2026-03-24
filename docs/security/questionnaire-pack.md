# Security questionnaire response pack

**Purpose:** Standard answers for common customer security and trust questions. Use as a trust-response kit for RFPs, security questionnaires, and due diligence.

**Format:** Short answer + detailed answer + evidence/source reference.

---

## Authentication

**Q: What authentication method do you use?**

**Short:** Email/password via Supabase Auth with optional SSO (SAML/OIDC). MFA supported where configured.

**Detailed:** Solvren uses Supabase Auth for identity. Users authenticate with email and password; email verification is required for sensitive operations. Organization admins can configure SAML 2.0 or OIDC SSO. Multi-factor authentication is available at the identity provider level when SSO is used.

**Evidence:** [`../security-phase0.md`](../security-phase0.md), Supabase Auth docs, `src/lib/server/authz.ts`

---

**Q: Do you support SSO / SAML / OIDC?**

**Short:** Yes. SAML 2.0 and OIDC are supported for organization-level SSO.

**Detailed:** Organization admins can configure identity providers via SAML or OIDC. Configuration is org-scoped; customers can use their existing IdP (Okta, Azure AD, etc.).

**Evidence:** `src/app/api/auth/sso/`, deployment docs

---

## Encryption

**Q: Is data encrypted in transit?**

**Short:** Yes. All traffic uses TLS (HTTPS). HSTS and secure headers are enforced in production.

**Detailed:** Application traffic is encrypted in transit. The hosting platform (Vercel) terminates TLS. The Next.js app sets HSTS, X-Content-Type-Options, Referrer-Policy, and related security headers in production. Database and API calls to Supabase use TLS.

**Evidence:** `next.config.ts`, [`control-matrix.md`](control-matrix.md) DP-01, Vercel/Supabase documentation

---

**Q: Is data encrypted at rest?**

**Short:** Yes. Database and storage use platform-managed encryption at rest (Supabase/AWS).

**Detailed:** Supabase (PostgreSQL and storage) provides encryption at rest via the underlying cloud provider. Integration credentials (OAuth tokens, API keys) are additionally encrypted at the application layer before storage.

**Evidence:** [`control-matrix.md`](control-matrix.md) DP-02, DP-03, Supabase security docs, `src/lib/server/crypto.ts`

---

**Q: How are integration credentials (OAuth tokens, API keys) protected?**

**Short:** Application-layer encryption (AES) with sealed storage; keys never in client code; key rotation supported.

**Detailed:** Third-party tokens and secrets are encrypted before being stored in the database. Encryption uses a server-side key (`ENCRYPTION_KEY`); dual-key rotation is supported for key rollover without re-encrypting all data. Secrets are never logged or exposed to the client.

**Evidence:** [`encryption-key-rotation.md`](encryption-key-rotation.md), `src/lib/server/crypto.ts`, `src/lib/server/integrationTokenFields.ts`

---

## Tenant isolation and access control

**Q: How do you ensure tenant isolation?**

**Short:** Row-level security (RLS) in PostgreSQL plus application-level authorization. Users cannot access data outside organizations they belong to.

**Detailed:** Database policies use `is_org_member(org_id)` to enforce org boundaries. Application routes use `requireOrgPermission` and `resolveResourceInOrg` to verify membership and permission before any data access. RLS is the primary guarantee; application checks are defense in depth.

**Evidence:** [`../security-phase0.md`](../security-phase0.md), RLS migrations, `src/lib/server/authz.ts`, [`integration-tests.md`](integration-tests.md)

---

**Q: What role-based access control (RBAC) do you support?**

**Short:** Organization-scoped roles (Owner, Admin, Reviewer, Member) with granular permissions for changes, approvals, settings, and admin actions.

**Detailed:** Permissions are defined in code and mapped to roles. Each organization member has a role; actions (view changes, approve, manage integrations, trigger jobs, etc.) require the corresponding permission. Admin and privileged operations require explicit permission checks, not just "logged in."

**Evidence:** `src/lib/rbac/permissions.ts`, [`policies/access-control-policy.md`](policies/access-control-policy.md), [`control-matrix.md`](control-matrix.md) AC-03

---

## Logging and monitoring

**Q: What do you log? What do you never log?**

**Short:** Security-relevant and admin actions are logged to an audit table. Errors go to Sentry. Passwords, tokens, and full credentials are never logged.

**Detailed:** Audit events (membership changes, integration config, approvals, etc.) are written to `audit_log` with redacted metadata. Production errors are sent to Sentry with PII scrubbing. Logging policy prohibits storing secrets or raw tokens in any log.

**Evidence:** [`policies/logging-monitoring-policy.md`](policies/logging-monitoring-policy.md), `src/lib/audit/`, [`data-classification.md`](data-classification.md)

---

**Q: How are production errors monitored and alerted?**

**Short:** Sentry for error tracking; alert routing documented in incident runbook; on-call and escalation paths defined.

**Detailed:** Sentry aggregates server and client errors. Critical failures are routed per incident runbook. Alert channels and escalation (including leadership notification for SEV-1/2) are documented.

**Evidence:** [`incident-response-runbook.md`](incident-response-runbook.md), [`control-matrix.md`](control-matrix.md) LM-*

---

## Backups and recovery

**Q: Are backups configured? How often?**

**Short:** Yes. Supabase provides automated backups per plan; configuration is reviewed quarterly.

**Detailed:** Database backups are managed by Supabase according to the project plan. Backup strategy and RPO/RTO expectations are documented. Configuration is reviewed quarterly.

**Evidence:** [`backup-recovery.md`](backup-recovery.md), [`policies/backup-recovery-policy.md`](policies/backup-recovery-policy.md)

---

**Q: Is restore from backup tested?**

**Short:** Yes. Restore procedure is documented and exercised at least annually; evidence is retained.

**Detailed:** A restore test checklist exists. Restore drills are performed on a schedule (minimum annual) and outcomes are documented in evidence.

**Evidence:** [`restore-test-checklist.md`](restore-test-checklist.md), `evidence/backups/`

---

## Incident response

**Q: What is your incident response process?**

**Short:** Defined severity model (SEV-1–4), assigned roles, documented workflow (detect → triage → contain → remediate → communicate → review), and mandatory postmortems for critical incidents.

**Detailed:** Incidents are classified by severity. Response roles (Incident Lead, Engineering Lead, Executive) are assigned. The workflow includes containment, remediation, communication (internal and customer-facing per policy), and recovery validation. SEV-1 and SEV-2 require post-incident review with lessons learned.

**Evidence:** [`incident-response-runbook.md`](incident-response-runbook.md), [`policies/incident-response-policy.md`](policies/incident-response-policy.md)

---

**Q: When do you notify customers of an incident?**

**Short:** When there is material impact to service or data. Timing aligns with contracts, DPA, and severity.

**Detailed:** Customer notification occurs when an incident materially affects service availability or customer data. SEV-1 (e.g., data exposure, cross-tenant risk) triggers immediate internal escalation and customer communication planning. Process is documented in the incident runbook.

**Evidence:** [`incident-response-runbook.md`](incident-response-runbook.md) §3

---

## Vendors and subprocessors

**Q: Who are your key vendors / subprocessors?**

**Short:** Core: Vercel (hosting), Supabase (database/auth), GitHub (code). Optional: Sentry, Resend, Slack, Stripe, OpenAI. Integration providers (Jira, GitHub, HubSpot, Salesforce, NetSuite) when customer-enabled.

**Detailed:** Full list with purpose and data types is in the subprocessor document. Critical infrastructure vendors are reviewed for security posture before adoption and on an ongoing basis.

**Evidence:** [`subprocessors.md`](subprocessors.md), [`vendor-inventory.md`](vendor-inventory.md)

---

**Q: Where is customer data processed or stored geographically?**

**Short:** Primary: United States. Supabase project region is configurable. Geographic options depend on deployment.

**Detailed:** Default deployment uses US-based hosting (Vercel, Supabase). Supabase supports region selection. Subprocessor locations are listed in the subprocessor document.

**Evidence:** [`subprocessors.md`](subprocessors.md), deployment docs

---

## Access review and privileged access

**Q: How often do you review access to production systems?**

**Short:** At least monthly. Access review covers Vercel, Supabase, GitHub, monitoring, and product admin capabilities; evidence is retained.

**Detailed:** A documented access review process runs monthly. It covers platform admin access (Vercel, Supabase, GitHub), monitoring access, and product-level admin permissions. Removals and changes are recorded; reviewer signoff is required.

**Evidence:** [`access-review-process.md`](access-review-process.md), `evidence/access-reviews/`

---

**Q: How is privileged / service-role access controlled?**

**Short:** Service role is used only from server code with documented reasons; inventory maintained; no client exposure.

**Detailed:** The Supabase service role bypasses RLS and is used only from trusted server contexts (cron, webhooks, background jobs). Each use is documented with a reason. Secrets are never in client bundles or public repos. Quarterly inventory review.

**Evidence:** `docs/service-role-inventory.md`, [`control-matrix.md`](control-matrix.md) AC-04, AC-05

---

## Data deletion and retention

**Q: What is your data retention policy? How is data deleted?**

**Short:** Configurable retention per resource type (audit log, notifications, tombstones); automated retention sweep; soft delete for changes; org purge process defined but requires controlled admin execution.

**Detailed:** Retention policies are defined in the database. A retention sweep job runs on a schedule to purge expired audit log, notification, and tombstone data. Change events support soft delete. Full org data purge is a controlled process with audit and backup considerations.

**Evidence:** [`../security-phase0.md`](../security-phase0.md) Phase 1 pointers, `src/lib/server/runDataRetentionSweep.ts`, [`policies/data-handling-policy.md`](policies/data-handling-policy.md)

---

## SDLC and change management

**Q: How are production code changes reviewed and deployed?**

**Short:** All changes via pull request with approval; branch protection; migrations versioned; release log maintained; rollback path defined.

**Detailed:** Production code is merged only through pull requests with at least one approval. Branch protection enforces PR requirement, status checks, and blocks force pushes. Database changes use versioned migrations, reviewed for RLS impact. Each release is logged with timestamp, commit, and migrations. Rollback expectations are documented.

**Evidence:** [`change-management-runbook.md`](change-management-runbook.md), [`secure-sdlc.md`](secure-sdlc.md), `evidence/releases/release-log.md`

---

**Q: Do you have a secure development lifecycle (SDLC)?**

**Short:** Yes. PR checklist, security-sensitive change checklist, migration review for RLS, secret scanning expectations, dependency hygiene.

**Detailed:** Secure SDLC includes: code review for all production changes; security-sensitive areas (auth, RLS, service-role, credentials) require explicit security-minded review; migrations reviewed for RLS and data exposure; pre-merge secret scanning; monthly dependency review for critical vulnerabilities.

**Evidence:** [`secure-sdlc.md`](secure-sdlc.md)

---

## Compliance and certifications

**Q: Do you have SOC 2 / ISO 27001 / other certifications?**

**Short:** Solvren operates with SOC-ready controls (documented policies, evidence, runbooks). Formal attestation (SOC 2 Type I/II) may be pursued in a later phase.

**Detailed:** We have implemented a control framework, policies, access review, change management, incident response, and evidence collection consistent with SOC readiness. This enables efficient progression to formal audit when required.

**Evidence:** [`control-matrix.md`](control-matrix.md), policy set, evidence structure

---

## Contact

**Q: Who do we contact for security questions or incidents?**

**Short:** security@[your-domain].com. For urgent security issues, use the same channel and mark as urgent.

**Detailed:** Security and privacy inquiries, incident reports, and DPA requests can be sent to the designated security contact. Urgent matters should be clearly marked.

**Evidence:** Update `[your-domain]` with your actual domain (e.g. `solvren.com`) before sharing with customers. Use a monitored alias such as `security@`, `privacy@`, or `compliance@`.
