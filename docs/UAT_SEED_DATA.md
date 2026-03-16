# UAT Seed Data and Demo Dataset

Pass 5 creates a deterministic, realistic seeded environment for UAT, beta demos, and workflow validation. Every tester starts from the same known state.

## Quick Start

See [PRE_UAT_CHECKLIST.md](./PRE_UAT_CHECKLIST.md) for the full pre-UAT checklist. Summary:

```bash
# 1. Use local Supabase and apply migrations (recommended for UAT)
supabase start
supabase db reset

# 2. Ensure .env.local has Supabase credentials (from supabase status)
#    NEXT_PUBLIC_SUPABASE_URL=...
#    SUPABASE_SERVICE_ROLE_KEY=...

# 3. Run seed
npm run seed

# 4. Start app
npm run dev
```

**Prerequisites**: The seed requires migrations through 110+ (approval_roles, approval_mappings, is_restricted, revenue_impact_reports, coordination_plans, change_timeline_events). Run `supabase db reset` or push all migrations before seeding.

## Seeded Personas

All personas use the same password (configurable via `UAT_SEED_PASSWORD`). Default: `UAT-Pass5-Demo!`

| Persona | Email | Role | Purpose |
|---------|-------|------|---------|
| **Olivia Owner** | owner@uat.solvren.test | OWNER | Full org setup, admin controls, visibility into everything |
| **Adam Admin** | admin@uat.solvren.test | ADMIN | Manage users/settings/mappings without owner-only edge cases |
| **Sophie Submitter** | submitter@uat.solvren.test | SUBMITTER | Create drafts, guided intake, evidence work, submit for review |
| **Riley Reviewer** | reviewer@uat.solvren.test | REVIEWER | Standard review/approval flow; Data Reviewer approval role |
| **Victor Viewer** | viewer@uat.solvren.test | VIEWER | Read-only visibility tests |
| **Fiona Finance** | finance@uat.solvren.test | REVIEWER | Finance domain view/review; Finance Reviewer approval role |
| **Sam Security** | security@uat.solvren.test | REVIEWER | Security domain view/review; Security Reviewer approval role |
| **Renee Restricted** | restricted@uat.solvren.test | REVIEWER | Explicit restricted-access tests; grant to specific restricted changes |

### Login

Sign in with any persona email and the shared password. After sign-in, you may need to complete email verification if your Supabase project requires it. UAT users are created with `email_confirm: true`.

## Primary UAT Organization

**Acme Revenue Ops**

- Notification emails: ops@acme.example.com
- Daily inbox / weekly digest: enabled where configured
- Domains enabled: REVENUE, SECURITY

### Approval Roles (seeded)

- Finance Reviewer → Fiona Finance
- Security Reviewer → Sam Security
- Billing Owner → Adam Admin
- Revenue Leadership
- Data Reviewer → Riley Reviewer

### Approval Mappings

| Trigger Type | Trigger Value | Approval Role |
|--------------|---------------|---------------|
| DOMAIN | REVENUE | Finance Reviewer |
| DOMAIN | SECURITY | Security Reviewer |
| SYSTEM | Stripe | Billing Owner |
| CHANGE_TYPE | PRICING | Revenue Leadership |
| CHANGE_TYPE | BILLING | Billing Owner |

### Domain Permissions

- Fiona: REVENUE view+review
- Sam: REVENUE, SECURITY view+review
- Sophie, Victor: REVENUE view only
- Riley: REVENUE view+review

## Seeded Sample Changes

| Title | Status | Domain | Change Type | Systems | Purpose |
|-------|--------|--------|-------------|---------|---------|
| **Stripe Pricing Logic Update** | IN_REVIEW | REVENUE | PRICING | Stripe, Chargebee | High risk, revenue impact report, coordination autopilot |
| **Billing Reconciliation Patch** | IN_REVIEW | REVENUE | BILLING | Stripe, NetSuite | Blocked by evidence (required items missing) |
| **Q1 Revenue Recognition Rule Update** | APPROVED | REVENUE | REVENUE_INTEGRATION | NetSuite | Completed happy path, timeline, audit |
| **HubSpot to Salesforce Lead Routing Sync** | DRAFT | REVENUE | CRM_SCHEMA | HubSpot, Salesforce | Guided intake, readiness validation |
| **Security Review for Billing Auth Hardening** | IN_REVIEW | SECURITY | OTHER | Stripe, Okta | Restricted visibility; Renee has explicit grant |
| **NetSuite Chart of Accounts Update** | IN_REVIEW | REVENUE | REVENUE_INTEGRATION | NetSuite | Overdue approval, appears in overdue queue |
| **Chargebee Plan Migration Draft** | DRAFT | REVENUE | BILLING | Chargebee | Partially completed, resume guided intake |
| **Pricing Tier Rename — Revised** | DRAFT | REVENUE | PRICING | Stripe | Rejected then revised; rework flow |

## Demo Dataset (polished subset)

For executive/product demos, use these records:

| Demo Item | Change | Why |
|-----------|--------|-----|
| **A — Hero** | Stripe Pricing Logic Update | High risk revenue impact, finance+billing approver suggestions, evidence checklist |
| **B — Blocked** | Billing Reconciliation Patch | Blocked evidence, overdue governance |
| **C — Completed** | Q1 Revenue Recognition Rule Update | Completed governance history |
| **D — Restricted** | Security Review for Billing Auth Hardening | Fine-grained visibility, enterprise credibility |

### Demo narratives

- **Executive**: Dashboard, high-risk change, revenue impact report, why approvals/evidence were suggested, blocked item, reduced coordination story.
- **Submitter**: Guided intake, autopilot suggestions, one-click apply, submit.
- **Reviewer**: My Approvals, evidence blocker, approve after evidence complete.

## Reset / Reproducibility

The seed script is **idempotent**: running it again will upsert/merge data. To start fresh:

1. **Option A**: Reset the database (e.g. `supabase db reset`) and run migrations, then `npm run seed`.
2. **Option B**: Manually delete the UAT org and its related data, then run `npm run seed`.

### Determinism

- Change IDs use fixed UUIDs (e.g. `11111111-1111-5000-8000-000000000001`).
- Timestamps derive from a fixed reference: `2025-01-15 12:00:00 UTC`.
- Overdue scenarios use `ts(-2)` (2 days before reference) for due dates.

## Environment Prerequisites

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (bypasses RLS)
- Optional: `UAT_SEED_PASSWORD` — Override default password for personas

## Commands

| Command | Description |
|---------|-------------|
| `npm run seed` | Run UAT seed script |
| `npm run dev` | Start app for testing |
| `npm run seed && npm run test:e2e` | Full E2E (requires seed first) |

## Search Keywords

Sample changes are findable by:

- **Stripe** — Stripe Pricing Logic Update, Billing Reconciliation Patch, Security Review, Pricing Tier Rename
- **NetSuite** — Billing Reconciliation Patch, Q1 Revenue Recognition, NetSuite Chart of Accounts
- **HubSpot** — Lead Routing Sync
- **pricing** — Stripe Pricing Logic, Pricing Tier Rename
- **billing** — Billing Reconciliation, Chargebee Plan Migration
