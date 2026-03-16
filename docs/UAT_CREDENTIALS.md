# UAT Test Credentials

Use these credentials to test Solvren end-to-end with a pre-seeded organization.

## Quick Setup

```bash
# 1. Apply migrations (including revenue_policies)
supabase db push
# or: supabase db reset

# 2. Run seed
npm run seed

# 3. Start app
npm run dev
```

Then sign in at `/login` with any persona below.

---

## Login Credentials

**All personas use the same password:** `UAT-Pass5-Demo!`  
(Override with `UAT_SEED_PASSWORD` env var when running the seed.)

| Persona | Email | Password | Role | Use for |
|---------|-------|----------|------|---------|
| **Olivia Owner** | owner@uat.solvren.test | UAT-Pass5-Demo! | Owner | Full admin, org setup |
| **Adam Admin** | admin@uat.solvren.test | UAT-Pass5-Demo! | Admin | Settings, policies, approval mappings |
| **Sophie Submitter** | submitter@uat.solvren.test | UAT-Pass5-Demo! | Submitter | Create changes, evidence, submit |
| **Riley Reviewer** | reviewer@uat.solvren.test | UAT-Pass5-Demo! | Reviewer | My approvals, review flow |
| **Victor Viewer** | viewer@uat.solvren.test | UAT-Pass5-Demo! | Viewer | Read-only testing |
| **Fiona Finance** | finance@uat.solvren.test | UAT-Pass5-Demo! | Reviewer | Finance approvals |
| **Sam Security** | security@uat.solvren.test | UAT-Pass5-Demo! | Reviewer | Security approvals |
| **Renee Restricted** | restricted@uat.solvren.test | UAT-Pass5-Demo! | Reviewer | Restricted change access |

---

## Seeded Data Overview

### Organization
- **Acme Revenue Ops** — Domains: REVENUE, SECURITY

### Sample Changes (8)
| Change | Status | Purpose |
|--------|--------|---------|
| Stripe Pricing Logic Update | IN_REVIEW | High risk, revenue impact, coordination |
| Billing Reconciliation Patch | IN_REVIEW | Blocked (missing evidence) |
| Q1 Revenue Recognition Rule Update | APPROVED | Completed flow |
| HubSpot to Salesforce Lead Routing Sync | DRAFT | Guided intake |
| Security Review for Billing Auth Hardening | IN_REVIEW | Restricted (Renee only) |
| NetSuite Chart of Accounts Update | IN_REVIEW | Overdue approval |
| Chargebee Plan Migration Draft | DRAFT | Partial draft |
| Pricing Tier Rename — Revised | DRAFT | Rejected then revised |

### Risk Events (5)
- Jira PRC-182 (pricing, $420K, linked to change)
- Jira BIL-101 (billing, $90K, approved)
- Salesforce OPP-2048 (discount, $180K)
- NetSuite PB-12 (pricing, $120K)
- Stripe prod_abc (price, $550K)

### Revenue Policies (4)
- Discount > 30% → Require Approval
- Pricing Change → Require Approval
- Discount > 50% → Block
- Billing Rule → Monitor

---

## Suggested Test Paths

1. **Dashboard** — Login as `owner@uat.solvren.test` → See Revenue Exposure, Risk Cards, Activity Timeline, Copilot.
2. **My Approvals** — Login as `finance@uat.solvren.test` → Queue shows overdue and pending.
3. **Blocked** — Login as `admin@uat.solvren.test` → Billing Reconciliation Patch is blocked (evidence missing).
4. **Policies** — Login as `admin@uat.solvren.test` → Settings → Policies.
5. **Restricted** — Login as `restricted@uat.solvren.test` → Only Security Review change visible to her.
