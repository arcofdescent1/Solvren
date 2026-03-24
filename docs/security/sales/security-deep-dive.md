# Solvren Security — Technical Deep-Dive

**For:** Customer security engineers, technical evaluators

---

## Architecture

- **Stack:** Next.js (App Router) on Vercel; Supabase (PostgreSQL, Auth)
- **Multi-tenant:** Org-scoped RLS; `is_org_member(org_id)` enforces boundaries
- **Integrations:** OAuth-based; tokens encrypted at application layer; never in client

---

## Authentication and identity

- **Supabase Auth** for email/password; verified email required for sensitive ops
- **SSO:** SAML 2.0 and OIDC supported; org-level configuration
- **JIT provisioning:** Optional; when disabled, users must be invited before SSO login
- **Role mapping:** External IdP groups → Solvren org roles (configurable)

---

## Authorization (RBAC)

- **Roles:** Owner, Admin, Reviewer, Member
- **Permissions:** Granular (e.g., `change.approve`, `integrations.manage`, `policy.manage`)
- **Enforcement:** Server-side `requireOrgPermission`, `resolveResourceInOrg`; not client-only
- **Admin routes:** Require explicit permission (e.g., `admin.jobs.view`); not "logged in" alone

---

## Data protection

- **Encryption in transit:** HTTPS; HSTS and security headers in production
- **Encryption at rest:** Supabase/managed DB; integration credentials additionally encrypted in app
- **Redaction:** Logs and Sentry scrub secrets; `sanitizeAuditMetadata` for audit payloads
- **Export:** Permission-gated; audit-logged; rate-limited

---

## Integration assurance

- **Health tracking:** Last success, last failure, failure rate per org+provider
- **Scoped execution:** Every integration tied to `org_id`; every action auditable
- **Retry + dead-letter:** Bounded retries; admin visibility into failures
- **Token lifecycle:** Expiration tracking; refresh success/failure

---

## Operational controls

- **Access review:** Monthly; covers Vercel, Supabase, GitHub, product admin
- **Backup/restore:** Quarterly full drill; monthly validation
- **Change management:** PR required; migrations versioned; release log maintained
- **Incident response:** SEV-1–4 model; postmortems for critical; customer notification per policy

---

## Evidence and validation

- **Penetration test:** Annual; scope includes auth, RLS, APIs, admin, integrations, token handling
- **SOC alignment:** Control matrix, policies, evidence, operations cadence in place
- **Questionnaire pack:** Standard answers for common trust questions

---

**Reference:** `docs/security/` — control matrix, policies, questionnaire pack, customer docs
