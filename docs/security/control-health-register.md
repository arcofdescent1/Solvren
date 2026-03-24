# Control health register

**Purpose:** Single place to see whether controls are healthy, overdue, or failing. Update after each control execution or at least weekly.

**Owner:** Operations Owner  
**Related:** [`control-operations-calendar.md`](control-operations-calendar.md)

---

## Status legend

| Status | Meaning |
|--------|---------|
| **Healthy** | Completed on time; evidence filed |
| **Due soon** | Due within 7 days (monthly) or 14 days (quarterly) |
| **Overdue** | Past due; no valid exception |
| **Exception approved** | Temporary exception with approval; see [`exception-management.md`](exception-management.md) |
| **Failed** | Control execution failed; remediation in progress |

---

## Monthly controls

| Control ID | Control name | Owner | Cadence | Last completed | Next due | Status | Evidence | Notes |
|------------|--------------|-------|---------|----------------|----------|--------|----------|-------|
| AR-AC | Access review | Operations Owner | Monthly | — | 2026-04-07 | Due soon | [2026-03](evidence/access-reviews/2026-03.md) | |
| AR-BK | Backup validation | Operations Owner | Monthly | — | 2026-04-07 | Due soon | [template](evidence/backups/README.md) | |
| AR-DP | Dependency review | Engineering Lead | Monthly | — | 2026-04-07 | Due soon | [template](evidence/dependencies/README.md) | |
| AR-CM | Change verification | Engineering Lead | Monthly | — | 2026-04-07 | Due soon | [template](evidence/releases/README.md) | |
| AR-AL | Audit log review | Engineering Lead | Monthly | — | 2026-04-07 | Due soon | [template](evidence/monitoring/README.md) | |
| AR-MN | Monitoring review | Engineering Lead | Monthly | — | 2026-04-07 | Due soon | [template](evidence/monitoring/README.md) | |

---

## Quarterly controls

| Control ID | Control name | Owner | Cadence | Last completed | Next due | Status | Evidence | Notes |
|------------|--------------|-------|---------|----------------|----------|--------|----------|-------|
| QR-TT | Incident tabletop | Incident Lead | Quarterly | — | 2026-04-15 | Due soon | [template](evidence/quarterly/README.md) | |
| QR-VN | Vendor review | Vendor / Policy Owner | Quarterly | — | 2026-04-15 | Due soon | [template](evidence/vendors/README.md) | |
| QR-SO | Security ownership | Founder / Admin | Quarterly | — | 2026-04-15 | Due soon | [security-ownership.md](security-ownership.md) | |
| QR-DR | Disaster recovery | Operations Owner | Quarterly | — | 2026-04-15 | Due soon | [backup-validation](backup-validation-checklist.md) | |
| QR-RD | Full restore drill | Operations Owner | Quarterly | — | 2026-04-15 | Due soon | [2026-Q1](evidence/backups/2026-Q1-restore-drill.md) | |
| QR-SR | Quarterly security review | Founder / Admin | Quarterly | — | 2026-04-15 | Due soon | [template](evidence/quarterly/README.md) | |

---

## Update instructions

1. **After completing a control:** Set Last completed = completion date; set Next due = next period (e.g. +1 month); set Status = Healthy; link Evidence.
2. **Weekly check:** Review Next due; set Status to "Due soon" if within window; set "Overdue" if past due and no exception.
3. **If exception:** Record exception ID from [`exception-management.md`](exception-management.md); set Status = Exception approved.
4. **If failed:** Set Status = Failed; add item to [`security-remediation-register.md`](security-remediation-register.md); link remediation ID.

---

## Optional: internal admin page

A future Solvren internal page could surface:

- Overdue controls
- Last restore drill date
- Last access review date
- Last dependency review
- Recent service-role events
- Recent critical alerts

This would make control health visible without opening this file.
