# Solvren Security — One-Pager

**For:** Sales, customer success, initial trust conversations

---

## At a glance

Solvren is built to govern sensitive, revenue-impacting changes. Security is designed in from day one.

| What | How |
|------|-----|
| **Authentication** | Email/password + optional SAML/OIDC SSO |
| **Data isolation** | PostgreSQL RLS — tenants cannot access each other's data |
| **Encryption** | TLS in transit; at rest (Supabase); app-layer for integration tokens |
| **Access control** | RBAC with org-scoped roles and permissions |
| **Audit** | Security-relevant actions logged; no secrets in logs |
| **Validation** | Annual penetration testing; SOC-aligned controls |

---

## Trust differentiators

- **Externally validated** — Third-party pen test; findings remediated before enterprise rollout
- **Continuous operations** — Monthly access reviews, backup validation, change verification
- **Customer-ready docs** — Subprocessors, data protection, infrastructure, access control
- **Enterprise identity** — SSO-ready (SAML 2.0, OIDC); role mapping from IdP groups

---

## When to escalate

- Customer-managed keys (not currently supported)
- On-premise deployment
- Custom compliance frameworks beyond SOC alignment
- Detailed questionnaire requiring legal/engineering input

---

**Security contact:** security@[your-domain].com
