# Org purge — retention exceptions (Phase 7)

Authoritative default rule: **delete all org-owned operational data** unless it falls into an approved exception class below. The purge planner and verifier implement this policy; engineering must not invent new retention classes during execution.

## 1. Default delete rule

If data is:

- scoped to the organization in Solvren primary systems,
- not legally required to be retained,
- not platform-global,

→ it is **in scope for purge**.

## 2. Exception classes (v1)

| Class | Code | Treatment |
|--------|------|-----------|
| Billing / finance | `RETAIN_FINANCE` | Snapshot required fields in `org_purge_finance_retention_snapshots` before org row deletion; cancel active subscriptions; disable future billing automation. `billing_accounts` is removed by `ON DELETE CASCADE` after snapshot. |
| Legal / compliance hold | `RETAIN_LEGAL_HOLD` | **Hard block**: purge execution must not start when `legal_hold_active` is true on the request (status `blocked_legal_hold`). |
| Backups | `RETAIN_BACKUP_ONLY` | No immediate backup rewrite; backups expire per backup retention policy. Documented in runbook and trust materials. |
| Platform / shared | `RETAIN_PLATFORM_SHARED` | Rows with `org_id IS NULL` (e.g. global policies) are never targeted by `eq('org_id', orgId)` purge queries. |
| Irreversible aggregate analytics | `RETAIN_ANONYMIZED_AGGREGATE` | Only when documented as non-reconstructable to an org; otherwise treat as org data. **v1**: no separate aggregate store is exempted unless explicitly listed in inventory. |

## 3. Explicit non-exceptions (must purge)

- Org memberships and roles (removed with org / cascade).
- Integration accounts, credentials, schedules, dead letters, inbound events.
- Issues, changes, evidence, playbooks, simulations, detectors, policies **for that org** (`org_id = target`).
- Queues / processing jobs / retries for the org.
- Uploaded files and integration CSV uploads under org storage prefixes.
- Operational audit rows in `audit_log` for the org (org-level history is removed; **purge compliance trail** lives in `org_purge_*` tables).

## 4. Special database cases

- **`audit_log`**: `org_id` is **not** FK-linked to `organizations`. Purge performs an **explicit** `DELETE` for the org before `DELETE FROM organizations`.
- **`billing_accounts`**: FK `ON DELETE CASCADE`. Finance retention is satisfied via **snapshot**, not by keeping the live row.

## 5. Auth users

**Do not** delete `auth.users` as part of org purge. Membership rows are removed; users in other orgs remain valid.

## 6. External SaaS

v1: **disconnect locally**, revoke tokens where possible, stop webhooks/syncs. **No** guarantee of remote artifact deletion (Jira, Slack, etc.).
