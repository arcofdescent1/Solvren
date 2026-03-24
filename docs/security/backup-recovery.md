# Backup & recovery (Phase 1)

Solvren uses **Supabase Postgres** as the system of record.

## Database

| Topic | Baseline expectation |
|-------|----------------------|
| **Backup frequency** | Per Supabase project plan (typically daily; confirm in Supabase Dashboard → Database → Backups). |
| **PITR** | If enabled on plan, document window in Supabase UI. |
| **RPO target** | \< 24 hours (align with actual backup cadence). |
| **RTO target** | \< 4 hours for core app + DB restore (runbook-dependent). |
| **Restore owner** | Named on-call engineer + Supabase project admin. |

## What is backed up

- Postgres data covered by Supabase backups (schema + row data).
- **Not** automatically covered: local developer machines, uncommitted code, third-party integration state outside our DB.

## Object / file storage

If evidence or exports use **Supabase Storage** or external buckets: enable versioning where available; document separately from DB restore.

## Restore steps (outline)

1. Open Supabase Dashboard → restore to new branch or point-in-time (per product docs).
2. Point staging `DATABASE_URL` / Supabase keys at restored instance.
3. Run migrations if needed; verify `npm run typecheck` and smoke tests.
4. Update production only after validation and change window.

## Escalation

- Supabase support for platform-level restore issues.
- Internal incident channel for customer-impacting data loss.
