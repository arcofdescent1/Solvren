# Solvren UAT Script Pack

User Acceptance Testing scripts for validating the entire product. Testers can execute these without developer assistance.

---

## Table of Contents

1. [UAT Framework](#1-uat-framework)
2. [Persona-Based Tests](#2-persona-based-tests)
3. [Full Workflow Tests](#3-full-workflow-tests)
4. [Security and Access-Control Tests](#4-security-and-access-control-tests)
5. [Search and Notification Tests](#5-search-and-notification-tests)
6. [Execution Checklist and Defect Reporting](#6-execution-checklist-and-defect-reporting)

---

## 1. UAT Framework

### Purpose

UAT validates that the application behaves correctly for real users. These scripts complement automated E2E tests (Pass 6) by allowing human testers to:

- Execute core workflows end-to-end
- Verify expected outcomes
- Record pass/fail results
- Log defects consistently

### Prerequisites

1. **Seeded data** — Run `npm run seed` before UAT. See [UAT_SEED_DATA.md](./UAT_SEED_DATA.md).
2. **Environment** — `.env.local` with Supabase credentials; migrations applied.
3. **App running** — `npm run dev`

### Environment Setup

```bash
# 1. Ensure migrations applied
supabase db reset   # or push migrations

# 2. Run seed
npm run seed

# 3. Start app
npm run dev
```

### Persona Definitions

All personas use password: `UAT-Pass5-Demo!` (or `UAT_SEED_PASSWORD` if set)

| Persona | Email | Role | Use For |
|---------|-------|------|---------|
| Olivia Owner | owner@uat.solvren.test | OWNER | Org setup, full access |
| Adam Admin | admin@uat.solvren.test | ADMIN | Governance config, invites |
| Sophie Submitter | submitter@uat.solvren.test | SUBMITTER | Create, intake, submit |
| Riley Reviewer | reviewer@uat.solvren.test | REVIEWER | Approvals, queues |
| Victor Viewer | viewer@uat.solvren.test | VIEWER | Read-only, RBAC tests |
| Fiona Finance | finance@uat.solvren.test | REVIEWER | Finance domain approval |
| Sam Security | security@uat.solvren.test | REVIEWER | Security domain approval |
| Renee Restricted | restricted@uat.solvren.test | REVIEWER | Restricted visibility tests |

### Test Case Template

Each test case includes:

| Field | Purpose |
|-------|---------|
| Test ID | Unique identifier |
| Persona | Which seeded user runs the test |
| Objective | What is being validated |
| Prerequisites | Required state/data |
| Steps | Exact actions to perform |
| Expected Results | What should happen |
| Pass/Fail | Tester evaluation |
| Notes | Bug observations |

---

## 2. Persona-Based Tests

### Owner Tests

#### UAT-OWNER-01 — Organization Setup Review

| Field | Content |
|-------|---------|
| **Test ID** | UAT-OWNER-01 |
| **Persona** | Olivia Owner |
| **Objective** | Verify owner has full access to org settings and can review setup |
| **Prerequisites** | Logged in as Olivia Owner (owner@uat.solvren.test) |

**Steps:**

1. Navigate to **Settings** → **Org Settings** (or sidebar → Org Settings).
2. Open **Organization settings** link.
3. Verify org name, timezone (if shown), and notification settings.
4. Navigate to **Team & invites** (Settings → Team & invites, or /settings/users).
5. Verify seeded users (Adam, Sophie, Riley, Victor, Fiona, Sam, Renee) appear.

**Expected Results:**

- Org settings visible and editable
- Users correctly listed with roles
- Owner has full access; no access denied

**Pass/Fail:** ____________

**Notes:** _________________________________________________

---

#### UAT-OWNER-02 — Governance Configuration Review

| Field | Content |
|-------|---------|
| **Test ID** | UAT-OWNER-02 |
| **Persona** | Olivia Owner |
| **Objective** | Verify approval roles and mappings are configured |
| **Prerequisites** | Logged in as Olivia Owner |

**Steps:**

1. Navigate to **Settings** → **Approval Roles**.
2. Verify seeded roles exist: Finance Reviewer, Security Reviewer, Billing Owner, Data Reviewer, Revenue Leadership.
3. Navigate to **Settings** → **Approval Mappings**.
4. Verify mapping examples exist (e.g., DOMAIN/REVENUE → Finance Reviewer, SYSTEM/Stripe → Billing Owner).

**Expected Results:**

- Roles visible with assigned users
- Mappings visible; mappings reference correct systems/domains and roles

**Pass/Fail:** ____________

**Notes:** _________________________________________________

---

### Admin Tests

#### UAT-ADMIN-01 — Invite New User

| Field | Content |
|-------|---------|
| **Test ID** | UAT-ADMIN-01 |
| **Persona** | Adam Admin |
| **Objective** | Verify admin can invite a new user |
| **Prerequisites** | Logged in as Adam Admin (admin@uat.solvren.test) |

**Steps:**

1. Navigate to **Settings** → **Team & invites** (or /settings/users).
2. In "Invite user" section, enter email `testuser@uat.example.com`.
3. Assign role **Reviewer**.
4. Click **Send invite**.

**Expected Results:**

- Invitation created
- User appears in Pending invites list
- Success message shown

**Pass/Fail:** ____________

**Notes:** _________________________________________________

---

#### UAT-ADMIN-02 — Modify Approval Mapping

| Field | Content |
|-------|---------|
| **Test ID** | UAT-ADMIN-02 |
| **Persona** | Adam Admin |
| **Objective** | Verify admin can edit approval mappings |
| **Prerequisites** | Logged in as Adam Admin |

**Steps:**

1. Navigate to **Settings** → **Approval Mappings**.
2. Edit the mapping for SYSTEM/Stripe (or create one if missing).
3. Ensure Billing Owner role is assigned.
4. Save.

**Expected Results:**

- Mapping saved
- Coordination autopilot will suggest Billing Owner for Stripe changes

**Pass/Fail:** ____________

**Notes:** _________________________________________________

---

### Submitter Tests

#### UAT-SUBMITTER-01 — Create Draft Change

| Field | Content |
|-------|---------|
| **Test ID** | UAT-SUBMITTER-01 |
| **Persona** | Sophie Submitter |
| **Objective** | Create a draft change |
| **Prerequisites** | Logged in as Sophie Submitter (submitter@uat.solvren.test) |

**Steps:**

1. Navigate to **Changes** or click **New Change** in sidebar.
2. Enter title: **Stripe Pricing Adjustment**.
3. Select system **Stripe**, domain **REVENUE**, change type **PRICING**.
4. Save draft (or complete minimal intake and save).

**Expected Results:**

- Draft change created
- Change appears in user's draft list or changes
- Status shows DRAFT
- Guided intake panel visible on change page

**Pass/Fail:** ____________

**Notes:** _________________________________________________

---

#### UAT-SUBMITTER-02 — Complete Guided Intake

| Field | Content |
|-------|---------|
| **Test ID** | UAT-SUBMITTER-02 |
| **Persona** | Sophie Submitter |
| **Objective** | Complete intake and see readiness indicators |
| **Prerequisites** | Open a draft (e.g., "HubSpot to Salesforce Lead Routing Sync" or newly created draft) |

**Steps:**

1. Open the draft change.
2. Complete intake sections: Systems, Change Type, Revenue Impact, Customer Impact, Rollout, Evidence (attach PR if required), Approvals.
3. Observe readiness banner and any blockers.

**Expected Results:**

- Readiness indicators update as sections complete
- When required evidence and approvals are present, "Ready for Submission" appears
- Submission becomes available when ready

**Pass/Fail:** ____________

**Notes:** _________________________________________________

---

#### UAT-SUBMITTER-03 — Generate Coordination Plan

| Field | Content |
|-------|---------|
| **Test ID** | UAT-SUBMITTER-03 |
| **Persona** | Sophie Submitter |
| **Objective** | Generate coordination plan and see suggestions |
| **Prerequisites** | Open change affecting Stripe (e.g., "Stripe Pricing Logic Update" or new draft with Stripe) |

**Steps:**

1. Open change with Stripe as system.
2. Find **Coordination Autopilot** or **Coordination Plan** section.
3. Click **Generate Coordination Plan** (or **Regenerate**).

**Expected Results:**

- Coordination plan generated
- Suggested approvers appear (e.g., Billing Owner, Finance Reviewer)
- Suggested evidence appears (if applicable)
- Apply Approvers / Apply Evidence buttons available

**Pass/Fail:** ____________

**Notes:** _________________________________________________

---

#### UAT-SUBMITTER-04 — Generate Revenue Impact Report

| Field | Content |
|-------|---------|
| **Test ID** | UAT-SUBMITTER-04 |
| **Persona** | Sophie Submitter |
| **Objective** | Generate Revenue Impact Report |
| **Prerequisites** | Open change (e.g., "Stripe Pricing Logic Update") |

**Steps:**

1. Open change detail page.
2. Find **Revenue Impact Report** panel.
3. Click **Generate Report** (or **Regenerate** if already generated).

**Expected Results:**

- Report generated
- Risk level displayed (e.g., High, Very High)
- Failure modes listed
- Executive summary visible
- Required safeguards shown

**Pass/Fail:** ____________

**Notes:** _________________________________________________

---

#### UAT-SUBMITTER-05 — Submit for Review

| Field | Content |
|-------|---------|
| **Test ID** | UAT-SUBMITTER-05 |
| **Persona** | Sophie Submitter |
| **Objective** | Submit change for review |
| **Prerequisites** | Draft with "Ready for Submission"; coordination plan generated; required evidence and approvals present |

**Steps:**

1. Open a ready draft (e.g., complete "HubSpot to Salesforce Lead Routing Sync" or use a test draft).
2. Click **Submit for Review** (or **Submit Change**).

**Expected Results:**

- Status becomes IN_REVIEW
- Approval requests generated for suggested approvers
- Change appears in In Review queue
- Submitter sees success confirmation

**Pass/Fail:** ____________

**Notes:** _________________________________________________

---

### Reviewer Tests

#### UAT-REVIEWER-01 — View My Approvals

| Field | Content |
|-------|---------|
| **Test ID** | UAT-REVIEWER-01 |
| **Persona** | Riley Reviewer or Fiona Finance |
| **Objective** | Verify reviewer sees pending approvals |
| **Prerequisites** | Logged in as Riley Reviewer or Fiona Finance; seeded changes with pending approvals exist |

**Steps:**

1. Navigate to **Dashboard** or **My Approvals** (sidebar or /queue/my-approvals).
2. Verify changes appear in My Approvals.
3. Click a change to open it.

**Expected Results:**

- Changes awaiting approval visible
- Can open change and see approval panel
- Can view evidence and Revenue Impact Report

**Pass/Fail:** ____________

**Notes:** _________________________________________________

---

#### UAT-REVIEWER-02 — Approve Change

| Field | Content |
|-------|---------|
| **Test ID** | UAT-REVIEWER-02 |
| **Persona** | Fiona Finance or Riley Reviewer |
| **Objective** | Approve a change |
| **Prerequisites** | Pending approval for this persona; all required evidence present |

**Steps:**

1. Open change from My Approvals.
2. Review evidence and Revenue Impact Report.
3. Click **Approve** (or approve for your approval area).

**Expected Results:**

- Approval recorded
- Status updates; if all approvers have approved, change becomes APPROVED
- Timeline shows approval event

**Pass/Fail:** ____________

**Notes:** _________________________________________________

---

## 3. Full Workflow Tests

### UAT-WORKFLOW-01 — Full Change Lifecycle

| Field | Content |
|-------|---------|
| **Test ID** | UAT-WORKFLOW-01 |
| **Participants** | Submitter (Sophie), Reviewer (Fiona or Riley) |
| **Objective** | End-to-end lifecycle: create → submit → approve |

**Steps:**

1. **Submitter:** Create change, complete intake, generate coordination plan and Revenue Impact Report, apply approvers/evidence, submit.
2. **Reviewer:** Open My Approvals, find the change, review evidence, approve.
3. **Submitter/Reviewer:** Verify status transitions and timeline.

**Expected Results:**

- Status transitions: DRAFT → IN_REVIEW → APPROVED
- Timeline records submission, approval
- Approval recorded with approver and timestamp

**Pass/Fail:** ____________

**Notes:** _________________________________________________

---

### UAT-WORKFLOW-02 — Evidence Enforcement

| Field | Content |
|-------|---------|
| **Test ID** | UAT-WORKFLOW-02 |
| **Persona** | Riley Reviewer or Fiona Finance |
| **Objective** | Verify approval blocked when evidence is missing |
| **Prerequisites** | Change with missing required evidence (e.g., "Billing Reconciliation Patch") |

**Steps:**

1. Log in as reviewer.
2. Open change with missing evidence from My Approvals or Blocked queue.
3. Attempt to approve without adding evidence.

**Expected Results:**

- Approval blocked or disabled
- Error/message indicates missing evidence
- Change may appear in Blocked queue

**Pass/Fail:** ____________

**Notes:** _________________________________________________

---

### UAT-WORKFLOW-03 — Coordination Autopilot Suggestions

| Field | Content |
|-------|---------|
| **Test ID** | UAT-WORKFLOW-03 |
| **Persona** | Sophie Submitter |
| **Objective** | Stripe change suggests Billing Owner and Finance Reviewer |
| **Prerequisites** | Seeded approval mappings; create or open change affecting Stripe |

**Steps:**

1. Create change with system **Stripe** and domain **REVENUE**.
2. Generate coordination plan.
3. Check suggested approvers and evidence.

**Expected Results:**

- Billing Owner suggested (from SYSTEM/Stripe mapping)
- Finance Reviewer suggested (from DOMAIN/REVENUE mapping)

**Pass/Fail:** ____________

**Notes:** _________________________________________________

---

### UAT-WORKFLOW-04 — Stale Report Regeneration

| Field | Content |
|-------|---------|
| **Test ID** | UAT-WORKFLOW-04 |
| **Persona** | Sophie Submitter |
| **Objective** | Report marked stale after edit; regenerate works |
| **Prerequisites** | Change with existing Revenue Impact Report |

**Steps:**

1. Open change with generated report.
2. Edit systems or domain (or other intake that affects risk).
3. Return to change; observe report.
4. Click **Regenerate** on Revenue Impact Report.

**Expected Results:**

- Report marked **stale** (or indicator shown)
- Regeneration produces new report reflecting current intake

**Pass/Fail:** ____________

**Notes:** _________________________________________________

---

## 4. Security and Access-Control Tests

### UAT-RBAC-01 — Viewer Restrictions

| Field | Content |
|-------|---------|
| **Test ID** | UAT-RBAC-01 |
| **Persona** | Victor Viewer |
| **Objective** | Viewer cannot create changes |
| **Prerequisites** | Logged in as Victor Viewer (viewer@uat.solvren.test) |

**Steps:**

1. Look for "New Change" or create-change action.
2. Attempt to create a change (e.g., navigate to /changes/new if link visible).
3. If no link, attempt direct URL /changes/new.

**Expected Results:**

- Action blocked or link hidden
- If navigated directly, access denied or redirect

**Pass/Fail:** ____________

**Notes:** _________________________________________________

---

### UAT-RBAC-02 — Admin Page Restrictions

| Field | Content |
|-------|---------|
| **Test ID** | UAT-RBAC-02 |
| **Persona** | Sophie Submitter |
| **Objective** | Submitter cannot access admin pages |
| **Prerequisites** | Logged in as Sophie Submitter |

**Steps:**

1. Attempt to navigate to /admin/jobs.
2. Attempt to navigate to /admin/domains.
3. Attempt to navigate to /ops.

**Expected Results:**

- Access denied, 403, or redirect to dashboard
- Admin links not visible in sidebar for submitter

**Pass/Fail:** ____________

**Notes:** _________________________________________________

---

### UAT-SECURITY-01 — Restricted Change Visibility

| Field | Content |
|-------|---------|
| **Test ID** | UAT-SECURITY-01 |
| **Persona** | Sophie Submitter (or any user without restricted access) |
| **Objective** | Restricted change not visible to unauthorized users |
| **Prerequisites** | Seeded restricted change "Security Review for Billing Auth Hardening" |

**Steps:**

1. Log in as Sophie Submitter (no restricted access to this change).
2. Search for "Security Review" or "Billing Auth".
3. Check In Review queue and Dashboard.

**Expected Results:**

- Restricted change not visible in search results
- Not visible in queues or dashboard
- No leak of title or count

**Pass/Fail:** ____________

**Notes:** _________________________________________________

---

### UAT-SECURITY-02 — Explicit Restricted Access

| Field | Content |
|-------|---------|
| **Test ID** | UAT-SECURITY-02 |
| **Persona** | Renee Restricted |
| **Objective** | Renee sees restricted change she has explicit access to |
| **Prerequisites** | Seeded change "Security Review for Billing Auth Hardening" with Renee granted |

**Steps:**

1. Log in as Renee Restricted (restricted@uat.solvren.test).
2. Search for "Security Review" or navigate to change if known.
3. Verify change is visible.

**Expected Results:**

- Restricted change visible to Renee
- Renee can open and view it
- Other unauthorized users still cannot see it (per UAT-SECURITY-01)

**Pass/Fail:** ____________

**Notes:** _________________________________________________

---

## 5. Search and Notification Tests

### UAT-SEARCH-01 — Search Returns Grouped Results

| Field | Content |
|-------|---------|
| **Test ID** | UAT-SEARCH-01 |
| **Persona** | Sophie Submitter |
| **Objective** | Search returns changes, systems, approvals, evidence grouped |
| **Prerequisites** | Seeded data; logged in |

**Steps:**

1. Use top-nav search bar (or press `/`).
2. Type `stripe`.
3. Observe quick dropdown results.
4. Press Enter to open full search page.

**Expected Results:**

- Results grouped (Changes, Systems, Approvals, Evidence)
- Stripe-related changes appear
- Full search page shows grouped results with counts

**Pass/Fail:** ____________

**Notes:** _________________________________________________

---

### UAT-NOTIFY-01 — Notifications Appear

| Field | Content |
|-------|---------|
| **Test ID** | UAT-NOTIFY-01 |
| **Persona** | Riley Reviewer or Fiona Finance |
| **Objective** | Notifications for approval requests appear |
| **Prerequisites** | Change submitted with approver assigned; reviewer logged in |

**Steps:**

1. As Submitter: submit a change that assigns Reviewer.
2. As Reviewer: check bell icon / Notifications page.
3. Verify notification for approval request.

**Expected Results:**

- Notification appears for approver
- Can navigate to change from notification

**Pass/Fail:** ____________

**Notes:** _________________________________________________

---

## 6. Execution Checklist and Defect Reporting

### UAT Execution Checklist

Use this to track completion:

| Category | Completed |
|----------|-----------|
| Owner tests (UAT-OWNER-01, 02) | □ |
| Admin tests (UAT-ADMIN-01, 02) | □ |
| Submitter tests (UAT-SUBMITTER-01 through 05) | □ |
| Reviewer tests (UAT-REVIEWER-01, 02) | □ |
| Full workflow tests (UAT-WORKFLOW-01 through 04) | □ |
| RBAC tests (UAT-RBAC-01, 02) | □ |
| Security tests (UAT-SECURITY-01, 02) | □ |
| Search tests (UAT-SEARCH-01) | □ |
| Notification tests (UAT-NOTIFY-01) | □ |

**Tester:** _________________  **Date:** _________________

---

### Defect Reporting Template

For each defect found, record:

| Field | Description |
|-------|-------------|
| **Bug ID** | UAT-BUG-XXX (sequential) |
| **Title** | Short description |
| **Test ID** | Which UAT test revealed it |
| **Persona** | Which user |
| **Steps to reproduce** | Numbered steps |
| **Expected behavior** | What should happen |
| **Actual behavior** | What happened |
| **Severity** | Critical / Major / Minor / Enhancement |
| **Screenshot/logs** | Attach if available |

**Example:**

```
Bug ID: UAT-BUG-001
Title: Submit button disabled when all evidence present
Test ID: UAT-SUBMITTER-05
Persona: Sophie Submitter
Steps: 1. Open draft with full evidence. 2. Click Submit.
Expected: Submit succeeds.
Actual: Button stays disabled.
Severity: Critical
```

---

### Severity Levels

| Severity | Meaning |
|----------|---------|
| **Critical** | Blocks core workflow; no workaround |
| **Major** | Incorrect behavior; workaround exists |
| **Minor** | Cosmetic or usability issue |
| **Enhancement** | Improvement suggestion |

---

### UAT Acceptance Criteria

UAT **passes** when:

1. All critical workflows succeed (create, intake, coordination, report, submit, approve).
2. No critical defects remain open.
3. Major defects have workarounds or fixes scheduled.
4. RBAC and restricted visibility behave correctly.
5. Testers confirm expected behavior for their assigned scenarios.

UAT **fails** if:

- Critical defects block core workflows.
- Security/visibility defects allow unauthorized access.
- Tester cannot complete scripts due to blockers.

---

## See Also

- [UAT_SEED_DATA.md](./UAT_SEED_DATA.md) — Personas, seeded changes, login details
- [USER_GUIDE.md](./USER_GUIDE.md) — How to use the product
- [ADMIN_GUIDE.md](./ADMIN_GUIDE.md) — Governance configuration
