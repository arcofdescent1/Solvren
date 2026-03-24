# Backup and recovery policy

**Applies to:** Production databases and critical configuration required to restore Solvren service.

**Owner:** Operations Owner — see [`../security-ownership.md`](../security-ownership.md).

**Related:** [`../backup-recovery.md`](../backup-recovery.md), [`../restore-test-checklist.md`](../restore-test-checklist.md), controls AR-01, AR-02 in [`../control-matrix.md`](../control-matrix.md).

---

## 1. Purpose

Define what is backed up, recovery expectations, how often backups are reviewed, and who validates restore.

---

## 2. What is backed up

- **Primary customer and application data:** Postgres (Supabase) per provider backup features and plan.
- **Version control:** Source code and migrations in GitHub (authoritative for **schema** via migrations).
- **Infrastructure config:** Environment variables and hosting config documented or exportable from Vercel/hosting; **secrets** are re-entered from secure store, not pasted in tickets.

---

## 3. Restore expectations (RTO / RPO)

- **RPO (Recovery Point Objective):** Target aligned with Supabase backup frequency and any streaming/replication; document actuals in [`../backup-recovery.md`](../backup-recovery.md) as known.
- **RTO (Recovery Time Objective):** Target time to restore core read/write API and auth; refined as team drills restores.

*Initial targets for a small team:* document **actual** capabilities after first restore drill; avoid marketing SLAs until measured.

---

## 4. Backup review cadence

- **Quarterly:** Confirm backup product/plan still matches production; note changes in `evidence/backups/` or configuration evidence.
- **After major schema or infra change:** Verify backup still covers new critical data.

---

## 5. Restore validation ownership

- **Operations Owner** (or delegate) ensures **at least annual** restore drill or provider-validated restore exercise.
- Results recorded in [`../evidence/backups/`](../evidence/backups/) using checklist [`../restore-test-checklist.md`](../restore-test-checklist.md).

---

## 6. Failure response

- If backups are **missing or corrupted**: treat as **SEV-1/2** until scope is known; engage vendor support; communicate per incident policy.
- If **only partial** data recoverable: incident leadership + customer communication per contracts.

---

## 7. Review

This policy is reviewed **at least annually** and after any failed restore drill or provider incident.
