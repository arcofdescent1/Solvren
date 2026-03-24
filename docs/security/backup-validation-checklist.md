# Backup validation checklist

**Purpose:** Monthly backup status verification and structured restore validation. Quarterly full restore drill uses [`restore-test-checklist.md`](restore-test-checklist.md).

**Owner:** Operations Owner  
**Cadence:** Monthly (validation); Quarterly (full restore drill)  
**Evidence:** `evidence/backups/YYYY-MM-backup-validation.md` (monthly); `evidence/backups/YYYY-QX-restore-drill.md` (quarterly)

---

## Monthly validation points

- [ ] **Database backup exists** — Supabase dashboard or API; confirm latest snapshot/PITR
- [ ] **Expected retention window** — Per Supabase plan; document actual
- [ ] **Restore process still works** — If not doing full drill: verify restore path is documented and tested in last 90 days
- [ ] **Key tables present** — Spot-check critical tables in backup or last restore
- [ ] **Object/storage dependencies** — Any S3/Storage; confirm backup includes or is documented

---

## Quarterly full restore drill

Use [`restore-test-checklist.md`](restore-test-checklist.md):

1. Identify latest production backup / PITR snapshot
2. Restore into **non-production** project or database branch
3. Apply migrations if restore is raw
4. Set APP_URL, Supabase URL/keys to restored environment
5. Run `npm run typecheck` and unit tests
6. Smoke: login, dashboard, list changes for known org
7. Record date, engineer, pass/fail, anomalies

---

## Validation outcome

| Item | Pass/Fail | Notes |
|------|-----------|-------|
| Backup exists | | |
| Retention as expected | | |
| Restore path valid | | |
| Smoke test (quarterly) | | |

---

## Escalation

**A failed restore drill is a high-priority operational issue.**

Must produce:

- Incident or formal follow-up ticket
- Owner
- Remediation target date
- Entry in [`security-remediation-register.md`](security-remediation-register.md)

---

## Evidence

- **Monthly:** `evidence/backups/YYYY-MM-backup-validation.md`
- **Quarterly:** `evidence/backups/YYYY-QX-restore-drill.md`
