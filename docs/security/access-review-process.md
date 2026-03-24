# Access review process

**Purpose:** Make access to Solvren systems **reviewable** and **evidenced** on a recurring cadence.

**Owner:** Operations Owner (with Engineering Lead for product admin capabilities).

**Policy:** [`policies/access-control-policy.md`](policies/access-control-policy.md)  
**Evidence:** [`evidence/access-reviews/`](evidence/access-reviews/) — template filename `YYYY-MM.md`.

---

## 1. Scope

Review access for:

| System | What to verify |
|--------|----------------|
| **Vercel** | Who can deploy, env vars, project settings |
| **Supabase** | Project members, service role exposure, MFA |
| **GitHub** | Org/repo admin, branch protection still enforced |
| **Monitoring** (e.g., Sentry) | Who can view production errors and PII-adjacent context |
| **Secrets / env** | Who can read production secrets in hosting UI |
| **Email / comms** | Admin on transactional email provider if applicable |
| **Solvren product** | Internal admin permissions, super-admin patterns, routes that trigger jobs/retries/simulations/org settings |

---

## 2. Cadence

- **Minimum monthly:** complete one access review cycle and file evidence.
- **After onboarding/offboarding:** ad hoc update in the same month’s file or a dated addendum.

---

## 3. Procedure

1. **Export or list** current members/admins for each system (screenshot, CSV, or bullet list in evidence file).
2. For each person with **admin** or **production** access, confirm **role** and **business need**.
3. Identify **service-role-capable** access (Supabase service key holders, break-glass accounts).
4. **Remove or downgrade** access that is no longer needed; note **date** and **who** performed removal.
5. **Sign off** with reviewer name and date.

---

## 4. Product-specific review

In addition to SaaS consoles:

- Review **RBAC / admin routes** against current team responsibilities (see [`control-matrix.md`](control-matrix.md) AC-03, AC-04).
- Confirm **cron / internal job** triggers remain protected (secret headers, auth) — reference [`../security-phase0.md`](../security-phase0.md).

---

## 5. Evidence file contents

Each monthly file under `evidence/access-reviews/` must include:

- **Systems reviewed** (checklist)
- **Users reviewed** (name + role + still needed Y/N)
- **Removals/changes** (what, when, by whom)
- **Reviewer signoff** (name, date)

See: [`evidence/access-reviews/2026-03.md`](evidence/access-reviews/2026-03.md). Use [`access-review-checklist.md`](access-review-checklist.md) for structured steps.

---

## 6. Failure to complete on time

- Escalate to **Engineering Lead / founder** by **day 10** of the following month.
- Document reason and corrective action in the access review file when completed.
