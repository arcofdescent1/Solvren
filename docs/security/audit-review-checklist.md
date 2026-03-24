# Audit logging completeness review

**Purpose:** Ensure audit trail remains complete as the product evolves. No secrets in logs.

**Owner:** Engineering Lead  
**Cadence:** Monthly  
**Evidence:** `evidence/monitoring/YYYY-MM-audit-log-review.md`

---

## Review scope (sample)

Sample these sensitive workflows and confirm audit entries exist:

- [ ] **Org settings updates** — Changes to org config
- [ ] **Membership changes** — Invites, role changes, removals
- [ ] **Integration connect/disconnect** — OAuth flows, config changes
- [ ] **Privileged admin job triggers** — Cron, manual job runs
- [ ] **Approval decisions** — Approve/reject with reason
- [ ] **Retry/dead-letter actions** — Retry, ignore
- [ ] **Policy/admin mutations** — Policy create/update/archive, exceptions

---

## Verification points

| Check | Pass/Fail | Notes |
|-------|-----------|-------|
| Audit entries exist for sampled workflows | | |
| No secrets logged | | Passwords, tokens, keys |
| Taxonomy consistent | | Action names from catalog |
| New workflows have coverage | | Any new sensitive flow |

---

## Required action

**Any newly added sensitive workflow without audit coverage must be treated as a gap.**

- Add to [`security-remediation-register.md`](security-remediation-register.md)
- Assign owner
- Target: add audit coverage in next sprint

---

## Evidence

Create `evidence/monitoring/YYYY-MM-audit-log-review.md` with:

- Date, reviewer
- Workflows sampled
- Gaps found (if any)
- Follow-up actions
