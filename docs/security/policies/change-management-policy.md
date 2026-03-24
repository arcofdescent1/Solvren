# Change management policy

**Applies to:** Production application code, infrastructure-as-config (Vercel, env vars), and database schema for Solvren.

**Owner:** Engineering Lead — see [`../security-ownership.md`](../security-ownership.md).

**Related controls:** CM-01–CM-04 in [`../control-matrix.md`](../control-matrix.md).  
**Runbook:** [`../change-management-runbook.md`](../change-management-runbook.md).

---

## 1. Purpose

Ensure production changes are **reviewed**, **traceable**, and **reversible** to the extent practicable, reducing unauthorized or untested changes.

---

## 2. Code changes

### 2.1 Pull requests and review

- **All production code** is merged via **pull request** with at least **one approving review** from someone other than the author when team size allows.
- **Branch protection** on the default branch must enforce: PR required, approvals, no force-push, stale approval dismissal when new commits are pushed, and required status checks when CI exists.

### 2.2 Traceability

- Every production deployment must be **traceable** to a **commit** (and ideally PR) in version control.
- Releases are recorded in [`../evidence/releases/release-log.md`](../evidence/releases/release-log.md) (or linked release artifacts).

### 2.3 Direct production edits

- **Direct edits** to production (console one-offs, hot SQL without migration) are **prohibited** except under **emergency procedure** (see below).

---

## 3. Database migrations

- Schema and RLS changes are applied via **versioned migration files** checked into the repository.
- Migrations receive **normal PR review** with attention to **RLS impact**, **data exposure**, and **rollback** (see [`../secure-sdlc.md`](../secure-sdlc.md)).
- Migrations are **tested** in non-production (preview/staging/local) before production unless emergency and documented.

---

## 4. Emergency changes

- **Emergency fixes** may shorten review only when necessary to restore security or availability.
- **After the fact** (within 24–48 hours where feasible): document **what changed**, **who approved**, **PR or patch link**, and **verification** in the incident or release record.
- Follow up with a **normal PR** if the hot path bypassed standard review.

---

## 5. Release ownership and rollback

- Each production release has a **named owner** (releaser on duty).
- **Critical releases** must note a **rollback plan** (e.g., Vercel rollback, feature flag, or forward-fix) in the release log or PR description.

---

## 6. Evidence

- GitHub PR/merge history, Vercel deploy history, and [`../evidence/releases/release-log.md`](../evidence/releases/release-log.md) satisfy evidence needs for auditors and customers when combined with this policy.

---

## 7. Review

This policy is reviewed **at least annually** or when branching/deploy model changes materially.
