# Change verification checklist

**Purpose:** Verify engineering is actually following the documented change process. Sample recent production releases.

**Owner:** Engineering Lead  
**Cadence:** Monthly  
**Evidence:** `evidence/releases/YYYY-MM-change-verification.md`

---

## Sample criteria

Each monthly review should sample:

- **At least 3 recent releases** (or all releases if fewer than 3)
- **Any release with DB migration**
- **Any release touching auth, RLS, admin routes, or integrations** (if one exists in the period)

---

## Verification points (per sampled release)

| Check | Pass/Fail | Notes |
|-------|-----------|-------|
| PR traceability | | Every deploy maps to a PR |
| Review occurred | | At least one approval |
| Migrations reviewed and versioned | | If migration included |
| Emergency changes followed post-hoc rules | | If expedited, documented within 24–48h |

---

## Release log alignment

- [ ] `evidence/releases/release-log.md` is up to date
- [ ] Each production deploy has an entry
- [ ] Entries include: timestamp, commit, PR, owner, migrations (if any)

---

## Failure handling

If **repeated change-management drift** is found:

- Open remediation action in [`security-remediation-register.md`](security-remediation-register.md)
- Assign owner
- Update [`secure-sdlc.md`](secure-sdlc.md) guidance if needed

---

## Evidence

Create `evidence/releases/YYYY-MM-change-verification.md` with:

- Date, reviewer
- Releases sampled (list)
- Verification results per release
- Gaps or follow-up actions
