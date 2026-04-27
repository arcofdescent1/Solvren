# Solara Health — Sales demo organization

This document describes the **Solara Health** synthetic company seeded for live Solvren demos (governance, revenue exposure, queues, and change detail). Data is produced by **`scripts/seed-solara-demo.ts`**. It is **additive** to the existing **Acme Revenue Ops** UAT seed (`scripts/seed-uat.ts`); Acme remains the default QA/UAT org.

---

## Quick start

1. Apply all Supabase migrations to your project (same requirement as [UAT seed data](./UAT_SEED_DATA.md)).
2. Set **`NEXT_PUBLIC_SUPABASE_URL`** and **`SUPABASE_SERVICE_ROLE_KEY`** (e.g. in `.env.local`). The script auto-loads `.env.local` when present.
3. Run:

   ```bash
   npm run seed:solara-demo
   ```

   Equivalent:

   ```bash
   npx tsx scripts/seed-solara-demo.ts
   ```

4. Sign in with a Solara persona (see [Users and passwords](#users-and-passwords)) and ensure **Solara Health** is the active organization if your session uses another org first.

---

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role client (seed bypasses RLS) |
| `SOLARA_DEMO_PASSWORD` | No | Password applied to all Solara demo auth users on each run. Default in script: `Solara-Demo-2026!` |
| `ALLOW_DEMO_SEED` | Conditional | Must be `true` when the Supabase URL is **not** treated as local (see [Safety guardrails](#safety-guardrails)) |

---

## Safety guardrails

The script refuses to run against **non-local** Supabase hosts unless you explicitly opt in:

- **Local** (no `ALLOW_DEMO_SEED` required): hostname is `localhost`, `127.0.0.1`, `kong`, or ends with `.local`.
- **Hosted** (staging/production): set **`ALLOW_DEMO_SEED=true`** after confirming the target project.

The org must match:

- **`slug`** = `solara-health-demo`
- **`organizations.is_demo`** = `true`

If a row with slug `solara-health-demo` already exists but **`is_demo` is false**, the script **exits without modifying** that org (prevents overwriting a real tenant that reused the slug).

**Deletion scope:** Before insert, the script removes any **`change_events`** (and dependent rows) whose **id** is one of the six reserved Solara UUIDs, **project-wide**. That handles stray rows from an earlier failed run under a different `org_id` (primary keys are global). There are **no** broad table wipes beyond those six ids, and **no** impact on the Acme UAT org (which uses different fixed UUIDs).

---

## Organization profile

| Field | Value |
|-------|--------|
| Name | Solara Health |
| Slug | `solara-health-demo` |
| `demo_slug` | `solara-health-demo` (stable idempotent key for demo tooling) |
| `is_demo` | `true` |
| Website | `https://solarahealth.example` |
| `primary_domain` | `solarahealth.example` |
| Industry | B2B Healthcare SaaS |
| Company size | 51–200 |
| `demo_profile.demo_notes` | Narrative: ~$18M ARR, 2,500 customers, 85 employees; stack listed for demo talk track |

Narrative figures (**ARR, customer count, headcount, full tech stack**) are intentionally **not** added as custom schema: they live in **`demo_profile`**, **`change_events.intake`**, timeline copy, and impact report JSON.

**Tech stack used in seeded changes (no Salesforce):** HubSpot, Stripe, Chargebee, NetSuite, Snowflake, Zendesk, Jira, Slack — aligned to the demo story (CRM = HubSpot only).

---

## Users and passwords

All accounts use the email domain **`solara-demo.solvren.test`**. On every seed run, passwords are reset and **`email_confirm`** is set to true.

| Email | Display name | Org role | Notes |
|-------|----------------|----------|--------|
| `ryan.brooks@solara-demo.solvren.test` | Ryan Brooks | Owner | Primary presenter option (COO) |
| `emma.patel@solara-demo.solvren.test` | Emma Patel | Admin | Primary presenter option (RevOps) |
| `daniel.kim@solara-demo.solvren.test` | Daniel Kim | Reviewer | Finance; **Finance Reviewer** approval role |
| `priya.shah@solara-demo.solvren.test` | Priya Shah | Reviewer | Billing; **Billing Owner** approval role |
| `alex.morgan@solara-demo.solvren.test` | Alex Morgan | Reviewer | Engineering; **Data Reviewer** approval role |
| `sophie.martinez@solara-demo.solvren.test` | Sophie Martinez | Submitter | Product; typical change author |
| `maya.chen@solara-demo.solvren.test` | Maya Chen | Reviewer | VP Sales; **Revenue Leadership** approval role |
| `jordan.lee@solara-demo.solvren.test` | Jordan Lee | Reviewer | Customer Support Lead; appears in timeline narrative |

**Password:** `SOLARA_DEMO_PASSWORD` env var, or default **`Solara-Demo-2026!`** (see script header).

---

## Approval roles and mappings

Seeded **approval roles** (org-scoped): Finance Reviewer, Security Reviewer, Billing Owner, Revenue Leadership, Data Reviewer.

**Role members:**

- Finance Reviewer → Daniel Kim  
- Billing Owner → Priya Shah  
- Data Reviewer → Alex Morgan  
- Revenue Leadership → Maya Chen  
- Security Reviewer → Emma Patel  

**Approval mappings** (duplicates ignored with DB unique violation):

| Trigger type | Trigger value | Role |
|--------------|---------------|------|
| DOMAIN | REVENUE | Finance Reviewer |
| DOMAIN | SECURITY | Security Reviewer |
| SYSTEM | Stripe | Billing Owner |
| CHANGE_TYPE | PRICING | Revenue Leadership |
| CHANGE_TYPE | BILLING | Billing Owner |

**`org_demo_config`:** `is_demo_org: true`, `demo_scenario_key: solara-health-demo`, reset flags aligned with other demo orgs.

**Domains:** `REVENUE` enabled; `SECURITY` enabled when present in the project.

**Onboarding:** `initializeOnboarding` runs once per org (no-op if onboarding state already exists).

---

## Fixed change UUIDs (reset boundary)

Only these `change_events.id` values are deleted and re-inserted for the Solara org:

| Constant | UUID |
|----------|------|
| STRIPE_PRICING_HERO | `22222222-2222-5000-8000-000000000001` |
| BILLING_RECON | `22222222-2222-5000-8000-000000000002` |
| REVREC_Q1 | `22222222-2222-5000-8000-000000000003` |
| HUBSPOT_ROUTING | `22222222-2222-5000-8000-000000000004` |
| NS_COA | `22222222-2222-5000-8000-000000000005` |
| PROMO_DISCOUNT | `22222222-2222-5000-8000-000000000006` |

Child rows for these changes are cleared in dependency-safe order (see script `clearSolaraChangeArtifacts`), then changes and related data are inserted again.

---

## Seeded change catalog

### 1. Stripe pricing — Growth+ (hero)

- **ID:** `…000001`
- **Type:** `PRICING` · **Status:** `IN_REVIEW` · **Surface:** PRICING  
- **Systems:** Stripe, Chargebee, NetSuite, HubSpot  
- **Exposure:** `estimated_mrr_affected` 1,150,000 · `revenue_risk_score` 0.895 (supports ~$2.3M narrative total with other pending changes)  
- **SLA:** `DUE_SOON` · **Due:** slightly in the past (tension without marking full SLA overdue)  
- **Story:** Product-led Growth+ and usage billing; Finance not fully signed off; discount ambiguity.  
- **Approvals:** Maya (Revenue Leadership) **APPROVED**; Priya (Billing Owner) **PENDING**; Daniel (Finance Reviewer) **PENDING**.  
- **Governance / blocked queue:** `change_evidence` includes **EXPOSURE** and **ROLLBACK_PLAN**; **MONITORING** is missing (global REVENUE requirements — see below).  
- **Artifacts:** `revenue_impact_reports`, `coordination_plans`, `risk_signals`, `change_evidence_items` (missing monitoring), timeline events.

### 2. Billing reconciliation patch

- **ID:** `…000002`
- **Type:** `BILLING` · **Status:** `IN_REVIEW` · **Surface:** BILLING  
- **Systems:** Stripe, NetSuite, Snowflake  
- **Exposure:** 450,000 MRR × 0.74 score  
- **Story:** Stripe vs NetSuite mismatch; governance language in `intake` and timeline (Jordan: Zendesk / support readiness).  
- **Approvals:** None attached (underscores “governance not fully wired”).  
- **Blocked queue:** Only **EXPOSURE** in `change_evidence`; **ROLLBACK_PLAN** and **MONITORING** missing.

### 3. Q1 revenue recognition (completed “good path”)

- **ID:** `…000003`
- **Type:** `REVENUE_INTEGRATION` · **Status:** `APPROVED` · **Surface:** REPORTING  
- **Systems:** NetSuite, Snowflake  
- **Story:** Full approval chain and clean audit narrative.  
- **Approvals:** Daniel **APPROVED** (Finance Reviewer).  
- **Evidence:** All three global kinds present in `change_evidence` (EXPOSURE, ROLLBACK_PLAN, MONITORING).  
- **Risk output:** LOW bucket so executive “high-risk” counts focus on active hero items.

### 4. HubSpot lead routing

- **ID:** `…000004`
- **Type:** `CRM_SCHEMA` · **Status:** `IN_REVIEW` · **Surface:** CRM  
- **Systems:** HubSpot, Jira, Slack  
- **Exposure:** 610,000 × 0.84  
- **Story:** RevOps + Sales + engineering; misroute risk.  
- **Approvals:** Maya and Alex **PENDING** (Revenue Leadership + Data Reviewer).  
- **Evidence:** All three required `change_evidence` kinds present (not governance-blocked by missing evidence).  
- **Risk:** HIGH / high exposure score for executive revenue cards.

### 5. NetSuite chart of accounts (overdue)

- **ID:** `…000005`
- **Type:** `REVENUE_INTEGRATION` · **Status:** `IN_REVIEW` · **Surface:** REPORTING  
- **Systems:** NetSuite, Snowflake · **backfill_required:** true  
- **Exposure:** 520,000 × 0.86  
- **SLA:** `OVERDUE` · **Due:** in the past  
- **Approvals:** Daniel **PENDING** (Finance).  
- **Evidence:** All three kinds present.  
- **Risk:** CRITICAL bucket / high exposure for executive views and `/queue/overdue`.

### 6. Promotional discount rollout (draft)

- **ID:** `…000006`
- **Type:** `PRICING` · **Status:** `DRAFT` · **Surface:** PRICING  
- **Systems:** Stripe, Chargebee, HubSpot  
- **Story:** Spring expansion campaign; Finance not looped in; margin risk (copy in `intake`).  
- **No** `submitted_at` / MRR on pending revenue math where the app excludes non-submitted rows.

---

## Evidence model (blocked queue)

The **reviews** API (`/api/reviews/list`) resolves required evidence kinds for REVENUE changes from **`domain_approval_requirements`** when rows exist (seeded globally in migrations), which **overrides** the older domain governance templates for that calculation.

For **REVENUE**, the union of required kinds is:

- **EXPOSURE**
- **ROLLBACK_PLAN**
- **MONITORING**

Satisfaction is tracked via **`change_evidence`** rows (`kind` must match). The Solara seed sets:

- **Two IN_REVIEW governance-blocked changes:** hero (missing MONITORING) and billing recon (missing ROLLBACK_PLAN and MONITORING).  
- **Routing and COA:** all three kinds provided so they are not blocked by missing evidence (COA can still appear under **overdue** via SLA / due date).

**`change_evidence_items`** are also seeded for hero and billing for richer change-detail / checklist UX.

---

## Revenue at risk and executive surfaces

**Target:** roughly **$2.3M** “revenue at risk” as a rounded narrative; the product computes exposure from **`estimated_mrr_affected`** and **`revenue_risk_score`** (and related fields) on pending changes with **`submitted_at`** in the rolling window — there is **no** separate fake ARR column.

Primary demo routes:

| Route | Role in demo |
|-------|----------------|
| `/executive` | Summary driven by `/api/executive/summary` (risk buckets, MRR totals in window, overdue-style signals) |
| `/executive/revenue` | `/api/executive/revenue-summary` — **critical / high** lists use **`risk_assessment_outputs.exposure_score`** (≥ 75 treated as high on that page) |
| `/queue/blocked` | Missing required evidence (and other “needs details” rules) |
| `/queue/overdue` | `IN_REVIEW` with `due_at` in the past or `sla_status` escalated/overdue |
| `/changes/[id]` | Intake, timeline, approvals, evidence, reports |

**Counts are directional** (tuned, not hard-coded KPIs): four **`IN_REVIEW`** changes, three high/critical risk outputs for exec narrative, two evidence-blocked IN_REVIEW changes, one overdue-style change (COA).

---

## Other seeded data

- **`organization_settings`:** email on, Slack off, notification email `revops@solarahealth.example.com`  
- **`approval_requirements` + `org_bootstrap_status`:** same bootstrap pattern as UAT when not yet seeded  
- **`revenue_policies`:** a small set of example policies **only if** the org has none (discount, pricing, custom routing monitor)  
- **`risk_signals`:** attached to hero, routing, and COA changes for “top drivers” style narratives on executive summary  

---

## Reset behavior

- **Re-running** `npm run seed:solara-demo` updates org metadata, syncs users/passwords, upserts members/settings/config, and **replaces** only the six fixed changes and their dependents.  
- **Phase 8 in-app demo reset** (`src/modules/demo/services/demo-reset.service.ts`) currently clears **issues / outcomes / timeline** for demo-flag orgs — **not** governance changes. A comment in that file points here for the sales org; a future enhancement could reseed `change_events` from shared builders when resetting a demo org from the UI.

---

## Relationship to Acme (UAT)

| Aspect | Acme Revenue Ops | Solara Health |
|--------|------------------|---------------|
| Script | `npm run seed` → `seed-uat.ts` | `npm run seed:solara-demo` |
| Purpose | QA / UAT personas | Sales / client demo |
| Default npm seed | Yes | No (explicit command) |

Run Solara **after** migrations; order relative to Acme does not matter.

---

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| Script exits on hosted Supabase | Set `ALLOW_DEMO_SEED=true` |
| “Refusing” for wrong slug / `is_demo` | Org slug conflict; set `is_demo=true` for `solara-health-demo` or rename conflicting org |
| Exec or revenue pages look empty | Logged-in user’s **first** org membership (some APIs) or active org must be Solara |
| Password login fails | Re-run seed to reset password; confirm `SOLARA_DEMO_PASSWORD` if set |
| Migrations outdated | Align DB with repo migrations (same as UAT doc) |

---

## Source of truth

Implementation details can drift from this doc; the authoritative behavior is **`scripts/seed-solara-demo.ts`**.
