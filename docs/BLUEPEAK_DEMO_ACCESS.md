# BluePeak Home Services — demo access

**Classification:** Internal sales / training only. Contains a **shared demo password**. Do not forward outside authorized teams. Do not reuse these passwords elsewhere.

## Synthetic data

All BluePeak org data is **demo-safe and synthetic** (fake names, fake emails, no real customers). The in-app banner appears when the active organization has `is_demo = true`.

## How to sign in

Use your **production app URL** (the deployment whose `NEXT_PUBLIC_SUPABASE_URL` points at the same Supabase project where the demo was seeded). Sign in with **email + password** below. **v1:** no MFA and no SSO for these accounts.

## Shared password (all seeded demo users)

| Field        | Value                 |
| ------------ | --------------------- |
| **Password** | `BluePeakDemo2026!` |

Every account in the table uses this same password (reset by re-running the seed script).

## Organization

| Field        | Value                    |
| ------------ | ------------------------ |
| **Name**     | BluePeak Home Services   |
| **Slug**     | `bluepeak-home-services` |
| **Demo slug**| `bluepeak-home-services` |

## Email pattern

`{firstname}.{lastname}@bluepeak-demo.solvren.test`

---

## Primary personas (recommended for executive / role demos)

| Display name     | Email                                              | Org role (`organization_members.role`) | Department   | Notes (script)        |
| ---------------- | -------------------------------------------------- | -------------------------------------- | ------------ | --------------------- |
| Olivia Martinez  | `olivia.martinez@bluepeak-demo.solvren.test`       | `owner`                                | Executive    | CEO                   |
| Michael Turner   | `michael.turner@bluepeak-demo.solvren.test`        | `admin`                                | Executive    | COO                   |
| Rachel Brooks    | `rachel.brooks@bluepeak-demo.solvren.test`         | `reviewer`                             | Sales        | CRO                   |
| Daniel Price     | `daniel.price@bluepeak-demo.solvren.test`          | `reviewer`                             | Finance      | CFO                   |
| Sarah Chen       | `sarah.chen@bluepeak-demo.solvren.test`            | `admin`                                | RevOps       | Director, RevOps      |
| Marcus Lee       | `marcus.lee@bluepeak-demo.solvren.test`            | `admin`                                | Engineering  | VP Engineering        |
| Demo Admin       | `demo.admin@bluepeak-demo.solvren.test`            | `admin`                                | RevOps       | Demo / facilitator    |

**Password for all rows in this document:** `BluePeakDemo2026!`

---

## Operators and extended cast (same password)

| Display name   | Email                                          | Org role   | Department       |
| -------------- | ---------------------------------------------- | ---------- | ---------------- |
| Priya Nair     | `priya.nair@bluepeak-demo.solvren.test`        | `submitter`| Engineering      |
| Jason Patel    | `jason.patel@bluepeak-demo.solvren.test`       | `submitter`| Operations       |
| Emily Rogers   | `emily.rogers@bluepeak-demo.solvren.test`      | `submitter`| RevOps           |
| Lauren Kim     | `lauren.kim@bluepeak-demo.solvren.test`        | `reviewer` | Customer Success |
| David Ross     | `david.ross@bluepeak-demo.solvren.test`        | `reviewer` | Sales            |
| Kevin Sullivan | `kevin.sullivan@bluepeak-demo.solvren.test`  | `submitter`| Engineering      |

---

## Viewers (same password)

| Display name  | Email                                         | Org role | Department   |
| ------------- | --------------------------------------------- | -------- | ------------ |
| Brooke Adams  | `brooke.adams@bluepeak-demo.solvren.test`     | `viewer` | Sales        |
| Alex Morgan   | `alex.morgan@bluepeak-demo.solvren.test`      | `viewer` | Finance      |
| Jordan Lee    | `jordan.lee@bluepeak-demo.solvren.test`       | `viewer` | Marketing    |
| Taylor Reed   | `taylor.reed@bluepeak-demo.solvren.test`      | `viewer` | Marketing    |
| Casey Nguyen  | `casey.nguyen@bluepeak-demo.solvren.test`     | `viewer` | Operations   |
| Riley Carter  | `riley.carter@bluepeak-demo.solvren.test`    | `viewer` | Call Center  |
| Jamie Ortiz   | `jamie.ortiz@bluepeak-demo.solvren.test`      | `viewer` | Call Center  |

---

## Re-seed or reset (engineering)

From the repo root, with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set (e.g. in `.env.local`):

```bash
npm run seed:bluepeak-demo
```

The script deletes the org with slug `bluepeak-home-services`, removes auth users whose email ends with `@bluepeak-demo.solvren.test`, then recreates the demo org and data.

## Database migration (demo org columns)

Migration file: `supabase/migrations/207_bluepeak_demo_org_flags.sql`  
Adds `organizations.is_demo`, `demo_slug`, and `demo_profile`.

---

*Last updated: 2026-04-10 — aligned with `scripts/seed-bluepeak-demo.ts`.*
