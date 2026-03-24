# Security control evidence

**Purpose:** Structured storage of evidence used to demonstrate that Solvren's security controls are operating effectively.

**Owner:** Operations Owner (maintenance); individual owners per evidence type (see below).

**Review cadence:** Per control matrix — access reviews monthly; releases per deploy; incidents as they occur; configuration quarterly.

---

## Directory structure

| Directory | Contents | Owner |
|-----------|----------|-------|
| `access-reviews/` | Monthly admin access review records (`YYYY-MM.md`) | Operations Owner |
| `releases/` | Release log (`release-log.md`), change verification (`YYYY-MM-change-verification.md`) | Engineering Lead |
| `backups/` | Backup validation (`YYYY-MM-backup-validation.md`), restore drills (`YYYY-QX-restore-drill.md`) | Operations Owner |
| `incidents/` | Incident writeups, postmortems (`YYYY-MM-DD-slug.md`) | Incident Lead |
| `monitoring/` | Monitoring review (`YYYY-MM-monitoring-review.md`), audit log review (`YYYY-MM-audit-log-review.md`) | Engineering Lead |
| `vendors/` | Quarterly vendor review (`YYYY-QX-vendor-review.md`) | Vendor / Policy Owner |
| `dependencies/` | Monthly dependency vulnerability review (`YYYY-MM-dependency-review.md`) | Engineering Lead |
| `quarterly/` | Incident tabletop (`YYYY-QX-incident-tabletop.md`), security review (`YYYY-QX-security-review.md`) | Incident Lead / Founder |
| `configuration/` | Screenshots/exports: branch protection, Vercel access, Supabase settings, RLS migrations, Sentry scrubbing | Engineering Lead / Operations Owner |

---

## What gets stored here

- **Access reviews:** Systems reviewed, users reviewed, removals/changes, reviewer signoff — see [`../access-review-process.md`](../access-review-process.md).
- **Releases:** Deployment timestamp, commit/PR reference, owner, migrations included, incident link — see [`../change-management-runbook.md`](../change-management-runbook.md).
- **Backups:** Restore drill dates, steps executed, outcome — see [`../restore-test-checklist.md`](../restore-test-checklist.md).
- **Incidents:** Timeline, impact, actions taken, lessons learned — see [`../incident-response-runbook.md`](../incident-response-runbook.md).
- **Monitoring:** Alert test dates, health check validation, cron/job success snapshots.
- **Configuration:** Evidence of branch protection, env separation, RLS policies, Sentry scrubbing — for periodic audits.

---

## Updating evidence

- **Access reviews:** Create or update `access-reviews/YYYY-MM.md` each month per process.
- **Releases:** Append to `releases/release-log.md` for each production deploy (see [`../change-management-runbook.md`](../change-management-runbook.md)).
- **Incidents:** Create new file in `incidents/` for SEV-1/2 and material SEV-3.
- **Backups:** Add drill record to `backups/` after each restore test.
- **Vendors:** `vendors/YYYY-QX-vendor-review.md` each quarter.
- **Dependencies:** `dependencies/YYYY-MM-dependency-review.md` each month.
- **Quarterly:** `quarterly/YYYY-QX-incident-tabletop.md` and `quarterly/YYYY-QX-security-review.md` each quarter.
- **Configuration:** Refresh when settings change or at quarterly review.

---

## Sensitive data

**Never store** raw secrets, full credentials, or unredacted PII in evidence files. Use placeholders (e.g. `[REDACTED]`) or references to controlled systems. Evidence should be shareable with auditors under NDA without exposing production secrets.
