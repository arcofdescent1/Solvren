# Evidence operations workflow

**Purpose:** Ensure evidence exists as a byproduct of operation, not a scramble before review. Every recurring control specifies where evidence is stored, naming, who records it, when it is due, and how completeness is checked.

**Owner:** Operations Owner  
**Related:** [`../control-operations-calendar.md`](../control-operations-calendar.md), [`../control-health-register.md`](../control-health-register.md)

---

## Evidence freshness standard

Evidence is **stale** if:

| Control type | Stale threshold |
|--------------|-----------------|
| Monthly control evidence | Older than **45 days** |
| Quarterly control evidence | Older than **120 days** |
| Release/change evidence | Missing for a production deploy |
| Backup evidence | Missing for the last scheduled review period |

---

## Naming conventions

| Control | Format | Example |
|---------|--------|---------|
| Access review | `access-reviews/YYYY-MM.md` | `access-reviews/2026-03.md` |
| Backup validation | `YYYY-MM-backup-validation.md` | `2026-03-backup-validation.md` |
| Restore drill | `YYYY-QX-restore-drill.md` | `2026-Q1-restore-drill.md` |
| Monitoring review | `YYYY-MM-monitoring-review.md` | `2026-03-monitoring-review.md` |
| Audit log review | `YYYY-MM-audit-log-review.md` | `2026-03-audit-log-review.md` |
| Vendor review | `YYYY-QX-vendor-review.md` | `2026-Q1-vendor-review.md` |
| Dependency review | `YYYY-MM-dependency-review.md` | `2026-03-dependency-review.md` |
| Change verification | `YYYY-MM-change-verification.md` | `2026-03-change-verification.md` |
| Incident tabletop | `YYYY-QX-incident-tabletop.md` | `2026-Q1-incident-tabletop.md` |
| Quarterly security review | `YYYY-QX-security-review.md` | `2026-Q1-security-review.md` |

---

## Control → evidence mapping

| Control | Evidence location | Who records | Due |
|---------|-------------------|-------------|-----|
| Access review | `access-reviews/YYYY-MM.md` | Operations Owner | 5th business day of following month |
| Backup validation | `backups/YYYY-MM-backup-validation.md` | Operations Owner | 5th business day of following month |
| Restore drill | `backups/YYYY-QX-restore-drill.md` | Operations Owner | Within first 3 weeks of quarter |
| Monitoring review | `monitoring/YYYY-MM-monitoring-review.md` | Engineering Lead | 5th business day of following month |
| Audit log review | `monitoring/YYYY-MM-audit-log-review.md` | Engineering Lead | 5th business day of following month |
| Vendor review | `vendors/YYYY-QX-vendor-review.md` | Vendor / Policy Owner | Within first 3 weeks of quarter |
| Dependency review | `dependencies/YYYY-MM-dependency-review.md` | Engineering Lead | 5th business day of following month |
| Change verification | `releases/YYYY-MM-change-verification.md` | Engineering Lead | 5th business day of following month |
| Incident tabletop | `quarterly/YYYY-QX-incident-tabletop.md` | Incident Lead | Within first 3 weeks of quarter |
| Quarterly security review | `quarterly/YYYY-QX-security-review.md` | Founder / Admin | Within first 3 weeks of quarter |

---

## Completeness check

**Weekly:** Operations Owner (or delegate) reviews [`control-health-register.md`](../control-health-register.md):

- Are monthly artifacts present for last month?
- Are quarterly artifacts present for last quarter?
- Any evidence past stale threshold?

**Action:** Update control health register; escalate overdue items; create remediation entries for gaps.

---

## Release evidence

- **Release log:** Append to `releases/release-log.md` for **each** production deploy.
- **No deploy without log entry.** If a deploy occurred without a log entry, backfill from Vercel/GitHub history.
