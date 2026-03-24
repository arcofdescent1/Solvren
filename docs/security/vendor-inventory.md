# Vendor inventory (internal)

**Purpose:** Internal register of critical third-party services that support Solvren production. Customer-facing summary: [`subprocessors.md`](subprocessors.md).

**Owner:** Vendor / Policy Owner  
**Policy:** [`policies/vendor-management-policy.md`](policies/vendor-management-policy.md)  
**Review:** Quarterly accuracy check; annual deep review of critical vendors.

---

## Legend

| Field | Meaning |
|-------|---------|
| **Data touched** | Types of data the vendor may process or store |
| **Prod criticality** | Critical = outage blocks core product; High = degrades significantly; Medium = feature impact; Low = optional |
| **Customer data** | Whether customer tenant data or credentials may pass through |
| **Owner** | Solvren role responsible for this vendor |

---

## Core infrastructure (production-critical)

| Vendor | Purpose | Data touched | Prod criticality | Customer data? | Security/compliance | Owner |
|--------|---------|--------------|------------------|----------------|---------------------|-------|
| **Vercel** | Hosting, serverless, deployments | App code, env vars, request/response | Critical | No (env only) | [Security](https://vercel.com/security) | Operations Owner |
| **Supabase** | Database, auth, storage, RLS | All app data, auth, customer tenant data | Critical | Yes | [Compliance](https://supabase.com/docs/guides/platform/security) | Operations Owner |
| **GitHub** | Source code, CI, issues | Code, secrets (via Actions), PRs | Critical | No | [Security](https://docs.github.com/en/enterprise-cloud@latest/security) | Engineering Lead |

---

## Monitoring and observability

| Vendor | Purpose | Data touched | Prod criticality | Customer data? | Security/compliance | Owner |
|--------|---------|--------------|------------------|----------------|---------------------|-------|
| **Sentry** | Error tracking, performance | Errors, stack traces, metadata (PII-scrubbed) | High | Possible in errors | [Trust](https://sentry.io/trust/) | Engineering Lead |

---

## Communications and integrations

| Vendor | Purpose | Data touched | Prod criticality | Customer data? | Security/compliance | Owner |
|--------|---------|--------------|------------------|----------------|---------------------|-------|
| **Resend** | Transactional email | Recipient email, content | Medium | Yes (emails) | [Security](https://resend.com/security) | Engineering Lead |
| **Slack** | Notifications, approval actions (optional) | Change metadata, approval payloads | Medium | Yes (change context) | [Enterprise Grid](https://slack.com/enterprise) | Engineering Lead |
| **Stripe** | Billing (optional) | Payment info, customer IDs | Medium | Yes (billing) | [Stripe security](https://stripe.com/security) | Engineering Lead |

---

## AI and optional services

| Vendor | Purpose | Data touched | Prod criticality | Customer data? | Security/compliance | Owner |
|--------|---------|--------------|------------------|----------------|---------------------|-------|
| **OpenAI** | AI checklist/suggestions (optional) | Prompt context, change text | Low | Yes (if enabled) | [Enterprise](https://openai.com/enterprise-privacy) | Engineering Lead |

---

## Integration providers (customer-configured)

These vendors connect when a customer enables an integration. Data flows per customer configuration.

| Vendor | Purpose | Data touched | Prod criticality | Customer data? | Security/compliance | Owner |
|--------|---------|--------------|------------------|----------------|---------------------|-------|
| **Atlassian (Jira)** | Issue sync, change links | Issues, projects, change refs | Medium | Yes | [Trust Center](https://www.atlassian.com/trust) | Engineering Lead |
| **GitHub** (App) | Repo sync, PR status | Repos, PRs, commit refs | Medium | Yes | [Security](https://docs.github.com/en/enterprise-cloud@latest/security) | Engineering Lead |
| **HubSpot** | CRM sync (optional) | Deal/contact data per config | Low | Yes | [Trust](https://trust.hubspot.com/) | Engineering Lead |
| **Salesforce** | CRM/object sync (optional) | Object data per config | Low | Yes | [Trust](https://www.salesforce.com/company/legal/trust/) | Engineering Lead |
| **NetSuite** | ERP sync (optional) | Record data per config | Low | Yes | [Oracle NetSuite security](https://www.netsuite.com/portal/products/erp/security.shtml) | Engineering Lead |

---

## Review log

| Date | Reviewer | Notes |
|------|----------|-------|
| 2026-03 | _TBD_ | Initial inventory created |
