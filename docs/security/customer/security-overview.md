# Solvren Security Overview

**Audience:** Customer security, procurement, and risk teams  
**Purpose:** High-level security posture and philosophy

---

## Security philosophy

Solvren is built to govern sensitive, high-impact changes across revenue-critical systems. Security is designed into the product from the ground up—not bolted on.

We operate with:

- **Defined controls** — Documented policies, evidence trails, and operating cadences
- **Continuous verification** — Access reviews, backup validation, monitoring, and change verification on schedule
- **External validation** — Annual penetration testing; SOC-aligned control environment
- **Transparent trust** — Customer-facing documentation, subprocessor list, and security contact

---

## Architecture overview

- **Application:** Next.js (App Router) on Vercel
- **Database & Auth:** Supabase (PostgreSQL, Row Level Security, Auth)
- **Integrations:** OAuth-based connections to Jira, Slack, HubSpot, Salesforce, NetSuite, GitHub (customer-configured)
- **Monitoring:** Sentry for error tracking; structured audit logging

All customer data resides in Supabase with org-scoped RLS. Integrations use application-layer encryption for tokens and secrets.

---

## Controls summary

| Area | Approach |
|------|----------|
| **Authentication** | Email/password via Supabase Auth; optional SAML 2.0 / OIDC SSO |
| **Authorization** | Role-based access (RBAC) with org-scoped permissions |
| **Tenant isolation** | PostgreSQL RLS; users cannot access data outside their organizations |
| **Encryption** | TLS in transit; encryption at rest (Supabase); app-layer encryption for integration credentials |
| **Audit** | Security-relevant actions logged; no secrets in logs |
| **Incident response** | Defined severity model, roles, and communication process |

---

## Trust artifacts

- **Subprocessors:** [Subprocessors list](/security/subprocessors) — who processes data on Solvren's behalf
- **Security contact:** security@[your-domain].com — for questions, incidents, DPAs
- **Data protection:** See [Data Protection](/security/data-protection) for storage, retention, deletion

---

## Compliance posture

Solvren operates a SOC-aligned control environment and can pursue formal SOC 2 certification when required. We support enterprise procurement through documented controls, evidence, and questionnaire responses.
