# Change management runbook

**Purpose:** Operational steps for **normal releases**, **migrations**, **emergency fixes**, and **rollback** expectations.

**Owner:** Engineering Lead  
**Policy:** [`policies/change-management-policy.md`](policies/change-management-policy.md)  
**Evidence:** [`evidence/releases/release-log.md`](evidence/releases/release-log.md), GitHub + Vercel history.

---

## 1. Normal release flow

1. **Branch** from protected default branch (feature/fix branch).
2. **Open PR** with description: purpose, risk, rollback note for risky changes.
3. **CI** passes (lint, typecheck, tests as configured).
4. **Approval** from at least one reviewer (author cannot be sole approver when team > 1).
5. **Merge** to default branch.
6. **Deploy** via Vercel (or pipeline) — confirm commit SHA matches merge.
7. **Log release** in [`evidence/releases/release-log.md`](evidence/releases/release-log.md): timestamp, PR link, commit, owner, migrations (if any).

---

## 2. Migration release flow

1. Add **versioned SQL** (or Supabase migration) in repo on the same PR as related code when possible.
2. **Review checklist** (from [`secure-sdlc.md`](secure-sdlc.md)): RLS impact, data exposure, rollback.
3. Apply to **non-prod** first; verify app behavior.
4. Apply to **production** via approved process (CLI, dashboard, or CI — team’s standard).
5. Record migration **filename/version** in release log entry.
6. If migration is **irreversible**, document **forward-fix** plan in PR or release log.

---

## 3. Emergency fix flow

1. **Declare** incident severity (see [`incident-response-runbook.md`](incident-response-runbook.md)).
2. **Minimize scope** — smallest change that restores safety or availability.
3. **Deploy** with expedited review if needed; **two-person rule** where possible (author + verifier).
4. **Within 24–48 hours:** backfill **PR**, **description**, and **release log** entry; link to incident ID.
5. If **direct prod edit** occurred (discouraged), document exact steps and validating query/output in incident evidence.

---

## 4. Rollback expectations

| Change type | Rollback approach |
|-------------|-------------------|
| **App deploy (Vercel)** | Promote previous deployment or revert commit + redeploy |
| **Feature flag** | Toggle off if used |
| **DB migration (reversible)** | Run down migration if exists and safe |
| **DB migration (one-way)** | Forward-fix only — plan before merge |

**Critical releases** must state rollback or forward-fix in PR description or release log **before** production apply when feasible.

---

## 5. GitHub branch protection (reference checklist)

Enable on default branch:

- [ ] Require pull request before merge  
- [ ] Require at least one approval  
- [ ] Dismiss stale approvals on new commits  
- [ ] Require status checks (when CI exists)  
- [ ] Block force pushes  
- [ ] Restrict who can push (if org policy allows)

Store proof in `evidence/configuration/` (screenshot or export) when audited.

---

## 6. Related documents

- [`secure-sdlc.md`](secure-sdlc.md) — PR and release checklists  
- [`../security-phase0.md`](../security-phase0.md) — env validation, headers, authz patterns
