# Solvren Access Control

**Audience:** Customer identity and access management teams

---

## Authentication

- **Email/password:** Supabase Auth; email verification required for sensitive operations
- **SSO:** SAML 2.0 and OIDC supported for organization-level single sign-on
- **MFA:** Available at the identity provider level when SSO is used

---

## Authorization (RBAC)

- **Organization-scoped roles:** Owner, Admin, Reviewer, Member
- **Permissions:** Granular (e.g., change.view, change.approve, integrations.manage)
- **Enforcement:** Server-side; routes require explicit permission checks

---

## Tenant isolation

- **Database:** Row Level Security (RLS) with `is_org_member(org_id)`; users cannot access rows outside their organizations
- **Application:** `requireOrgPermission` and `resolveResourceInOrg` verify membership and permission before data access
- **Integrations:** Every integration is tied to `org_id`; actions are org-scoped

---

## Privileged access

- **Service role:** Used only from trusted server contexts (cron, webhooks) with documented reasons
- **Admin routes:** Gated by RBAC; require explicit admin permissions
- **Audit:** Privileged actions are logged where applicable

---

## Access review

- Internal access to production systems is reviewed at least monthly
- Evidence is retained for audit
- Removal of access follows documented procedures
