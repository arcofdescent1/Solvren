# Org purge (tenant offboarding) — operator runbook

## Purpose

Controlled hard-delete of **tenant-scoped** application data for a single organization, with **documented retention exceptions**, **approvals**, **dry-run**, and **checkpointed execution**. This is **not** a time-based retention sweep.

## Preconditions

1. Retention exception policy agreed (`docs/architecture/org_purge_retention_exceptions.md`).
2. Inventory reviewed (`docs/architecture/org_purge_inventory.md` — regenerate via `node scripts/generate-org-purge-inventory.mjs`).
3. **Legal hold**: if any hold applies, set `legal_hold_active` on the request and **do not execute** until cleared.
4. Two-person approval in production (default: approver must differ from requester unless `ORG_PURGE_ALLOW_SAME_APPROVER=true` in environment — dev only).

## Flow

1. **Request** — Org admin (OWNER/ADMIN with `domains.manage`) opens **Admin → Org purge**, enters reason, declares legal hold status.
2. **Dry run** — Produces row counts, integration list, and retention summary. **No destructive writes.**
3. **Approve** — Second approver approves the request; optional `scheduled_execute_at` for cooling-off.
4. **Execute** — Idempotent steps: quiesce → queues → integrations → billing snapshot + Stripe cancel → identity extras → object storage → explicit DB deletes → `DELETE FROM organizations`.
5. **Verify** — Automated checks for zero rows in scoped tables (excluding purge audit tables).

## Backups

**Primary purge does not rewrite historical backups.** Backups age out per backup policy. Restoring a backup **must not** be used to resurrect a purged org except under explicit legal/administrative process.

## Failure and resume

- Each step is persisted in `org_purge_run_steps`. Failed steps can be investigated; **re-run execute** after fixing the underlying issue (executor skips completed steps).
- Purge is **not** one global transaction.

## Billing

- Stripe subscriptions are cancelled when configured.
- Financial snapshot JSON is stored in `org_purge_finance_retention_snapshots` before the org row is removed.

## Audit

- Product `audit_log` rows for the org are deleted as part of purge.
- Compliance trail: `org_purge_requests`, `org_purge_runs`, `org_purge_run_steps`, finance snapshots.

## API surface (v1)

- `GET/POST /api/admin/org-purge/requests?orgId=…`
- `POST /api/admin/org-purge/requests/[id]/dry-run`
- `POST /api/admin/org-purge/requests/[id]/approve`
- `POST /api/admin/org-purge/requests/[id]/execute`
- `GET /api/admin/org-purge/runs/[id]`
- `POST /api/admin/org-purge/runs/[id]/verify`

All routes require a verified session and `domains.manage` on the **target** org.
