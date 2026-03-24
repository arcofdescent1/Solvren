# Internal security ownership model

**Purpose:** Assign **accountable owners** for each security area. Every control in [`control-matrix.md`](control-matrix.md) maps to one of these owners — **no orphan controls**.

**How to use:** Replace `[Your Name]` with actual people. For small teams, one person may hold multiple roles.

---

## Role → person mapping (edit in place)

| Named role | Person / seat | Notes |
|------------|----------------|-------|
| **Engineering Lead** | [Your Name] | Overall technical security posture |
| **Operations Owner** | [Your Name] | Vercel, Supabase ops, backups, access reviews execution |
| **Incident Lead** | [Your Name] | Default incident commander (may equal Engineering Lead) |
| **Vendor / Policy Owner** | [Your Name] | Vendor inventory, subprocessors, policy refresh |
| **Founder / Admin** | [Your Name] | Executive escalation, contractual commitments |

---

## Area ownership

| Area | Owner role | Responsibilities |
|------|------------|------------------|
| **Auth / access (product)** | Engineering Lead (Auth) | Authz helpers, session handling, middleware patterns |
| **RLS / data isolation** | Engineering Lead (RLS / Data isolation) | Policies, migrations, integration tests for RLS |
| **Audit logging** | Engineering Lead (Audit logging) | Action catalog, `audit_log` usage, no secrets in metadata |
| **Integration secret handling** | Engineering Lead (Integration secrets) | Crypto, sealing, rotation runbooks |
| **Monitoring / alerts** | Engineering Lead (Monitoring) | Sentry, error budgets, alert routing |
| **Backup / restore** | Operations Owner | Vendor backups, restore drills, evidence |
| **Release / change management** | Engineering Lead | Branch protection, release log, migration discipline |
| **Policy maintenance** | Vendor / Policy Owner | Annual policy review, version dates |
| **Vendor inventory** | Vendor / Policy Owner | `vendor-inventory.md`, `subprocessors.md` |
| **Incident leadership** | Incident Lead | Runbook updates, postmortems, tabletop |
| **Privileged / service-role boundary** | Engineering Lead (Privileged boundary) | Inventory, code review gate, audit coverage |

---

## Control matrix coverage

Owners above correspond to **Technical owner** / **Owner** fields in [`control-matrix.md`](control-matrix.md). When adding a new control, **assign an owner** in the same edit.

---

## Review cadence

- **Quarterly:** Owners confirm accuracy of this doc (15 min).  
- **On hire/departure:** Reassign and complete access review per [`access-review-process.md`](access-review-process.md).


