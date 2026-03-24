# Data handling policy

**Applies to:** All Solvren-managed data including customer tenant data, integration credentials, logs, and backups.

**Owner:** Engineering Lead (RLS / Data isolation) + Vendor / Policy Owner for vendor commitments — see [`../security-ownership.md`](../security-ownership.md).

**Related:** [`../data-classification.md`](../data-classification.md), [`../../security-phase0.md`](../../security-phase0.md), controls DP-* in [`../control-matrix.md`](../control-matrix.md).

---

## 1. Purpose

Classify data, define how sensitive data is stored and deleted, how secrets are handled, and what must never appear in logs.

---

## 2. Data classification

Solvren uses at least these tiers (align names with [`../data-classification.md`](../data-classification.md)):

| Tier | Examples | Handling |
|------|-----------|----------|
| **Public** | Marketing site, public docs | No special restriction |
| **Internal** | Engineering runbooks, non-customer analytics | Access limited to Solvren; no public repos |
| **Confidential** | Customer business data in product, PII | Encrypted in transit and at rest; RLS; need-to-know |
| **Highly confidential** | Integration tokens, API keys, encryption keys, raw auth secrets | Encrypted at application layer where applicable; never logged; minimal retention in app logs |

---

## 3. Storage

- **Customer data** resides in the **primary database** (e.g., Supabase Postgres) with **RLS** and org-scoped application authorization.
- **Secrets** (integration tokens, etc.) are stored using **application encryption** and server-only configuration; see [`../encryption-key-rotation.md`](../encryption-key-rotation.md).
- **Backups** inherit provider encryption; access follows access-control policy.

---

## 4. Secrets handling

- **Never** commit secrets to git; use **secret scanning** and pre-merge checklist ([`../secure-sdlc.md`](../secure-sdlc.md)).
- **Rotation:** Compromised or exposed secrets are **rotated immediately**; integration keys follow documented rotation procedures.
- **Environment separation:** Production secrets exist only in **production** secret stores (e.g., Vercel production env), not in preview unless intentionally isolated test values.

---

## 5. Deletion and retention

- **Product retention** jobs and policies are documented in Phase 0/1 references (e.g., data lifecycle, cron retention).
- **Legal hold** or contractual retention may override default deletion — document exceptions.
- **Customer offboarding / deletion requests** are handled per contract and privacy commitments (procedure to be documented in ops runbook if not already).

---

## 6. Prohibited logging behavior

**Do not log:**

- Raw **passwords**, **session tokens**, **refresh tokens**, **API keys**, **OAuth access/refresh tokens**
- Full **credit card** or government ID numbers (if ever processed)
- **Encryption keys** or **service role** keys
- **Full integration credential payloads**

Use **structured audit metadata** with sanitization (e.g., `sanitizeAuditMetadata`) as implemented in codebase. Prefer **IDs and action types** over payloads.

---

## 7. Subprocessors and transfers

- Vendors that **process customer data** are listed in [`../vendor-inventory.md`](../vendor-inventory.md) and [`../subprocessors.md`](../subprocessors.md).
- New vendors touching **Confidential** or **Highly confidential** data require **vendor review** per [`vendor-management-policy.md`](vendor-management-policy.md).

---

## 8. Review

This policy is reviewed **at least annually** or when data categories or primary datastore changes.
