# Subprocessors (customer-facing)

**Purpose:** Simplified list of subprocessors that may process customer data on behalf of Solvren. Aligned with internal [`vendor-inventory.md`](vendor-inventory.md). Update per contractual notice requirements when adding or materially changing subprocessors.

**Last updated:** 2026-03-17

---

## Infrastructure and hosting

| Subprocessor | Purpose | Data processed | Location |
|--------------|---------|----------------|----------|
| **Vercel Inc.** | Application hosting, CDN, serverless compute | Request/response; env configuration (no customer content in env) | United States |
| **Supabase Inc.** | Database, authentication, object storage | All application data; customer tenant data; auth credentials | United States / EU (configurable) |
| **GitHub, Inc.** | Source code hosting, CI/CD | Application source code; build artifacts (no customer data) | United States |

---

## Monitoring and support

| Subprocessor | Purpose | Data processed | Location |
|--------------|---------|----------------|----------|
| **Functional Software, Inc. (Sentry)** | Error and performance monitoring | Error traces; stack frames; scrubbed metadata (PII removed per configuration) | United States |

---

## Communications (optional)

| Subprocessor | Purpose | Data processed | Location |
|--------------|---------|----------------|----------|
| **Resend Inc.** | Transactional email | Recipient addresses; email content | United States |
| **Slack Technologies** | In-app notifications, approval actions (when customer enables) | Change metadata; approval payloads; user identifiers | United States |

---

## Payments (optional)

| Subprocessor | Purpose | Data processed | Location |
|--------------|---------|----------------|----------|
| **Stripe, Inc.** | Payment processing | Payment details; billing identifiers; subscription state | United States |

---

## AI (optional)

| Subprocessor | Purpose | Data processed | Location |
|--------------|---------|----------------|----------|
| **OpenAI, L.L.C.** | AI-powered checklist and suggestion features (when enabled) | Prompt context; change descriptions; risk text | United States |

---

## Customer-configured integrations

When a customer enables an integration, the following may process data per that customer's configuration:

| Subprocessor | Purpose | Typical data |
|--------------|---------|--------------|
| **Atlassian (Jira Cloud)** | Issue sync, change linking | Issues, projects, status |
| **GitHub, Inc.** | Repository sync, PR status | Repos, PRs, commits |
| **HubSpot, Inc.** | CRM sync | Deals, contacts |
| **Salesforce, Inc.** | CRM/object sync | Objects per mapping |
| **Oracle NetSuite** | ERP sync | Records per config |

---

## Data processing

Solvren requires subprocessors to provide commitments consistent with applicable data protection requirements. DPAs are available upon request for qualifying customers.

**Updates:** Material changes to this list are communicated per contract. Customers may subscribe to subprocessor change notifications by contacting security@solvren.com (or equivalent).
