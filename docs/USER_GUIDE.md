# Solvren User Guide

A guide for everyday users: submitters, reviewers, domain specialists, and operations staff.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Key Concepts](#2-key-concepts)
3. [Navigating the Application](#3-navigating-the-application)
4. [Creating a Change](#4-creating-a-change)
5. [Guided Intake Workflow](#5-guided-intake-workflow)
6. [Coordination Autopilot](#6-coordination-autopilot)
7. [Revenue Impact Report](#7-revenue-impact-report)
8. [Submitting for Review](#8-submitting-for-review)
9. [Reviewing and Approving Changes](#9-reviewing-and-approving-changes)
10. [Evidence Requirements](#10-evidence-requirements)
11. [Notifications and Queues](#11-notifications-and-queues)
12. [Search](#12-search)

---

## 1. Introduction

### What Solvren Does

Solvren helps teams manage changes that affect revenue-impacting systems safely and consistently. When you modify billing logic, pricing, CRM data, or integrations, the product guides you through governance: evidence, approvals, and risk visibility.

**Why revenue governance matters**

Changes to billing, pricing, and revenue systems carry real financial risk. A misconfigured pricing rule, a broken integration, or a flawed data migration can cause double-billing, under-billing, or reporting errors. Solvren brings coordination and evidence requirements into one place so reviewers can approve confidently and executives can see what’s at risk.

**The core idea of a “change”**

A **Change** is a single unit of work that affects revenue-impacting systems. Examples:

- Stripe pricing logic update
- NetSuite revenue recognition rule change
- HubSpot to Salesforce lead routing sync

Each change goes through intake (guided capture), risk assessment, evidence collection, and approval before implementation. The product helps you coordinate approvers, attach evidence, and understand risk.

### Core Capabilities

- **Guided intake** — Step-by-step capture of systems, domains, and impact
- **Revenue Impact Report** — Automated risk analysis with failure modes and safeguards
- **Coordination Autopilot** — Suggested approvers and evidence from your governance model
- **Evidence enforcement** — Required artifacts based on risk level
- **Approval governance** — Domain- and system-based routing of approvals
- **Visibility** — Search, queues, and dashboards so you can find and act on changes quickly

---

## 2. Key Concepts

| Term | Description |
|------|-------------|
| **Change** | A single unit of work (feature, fix, migration) that affects revenue-impacting systems. Has a title, domain, systems, and status. |
| **Draft** | A change that is not yet submitted. You can edit intake, evidence, and approvals. Drafts are only visible to the owner and users with appropriate access. |
| **In Review** | A change that has been submitted and is awaiting approvals. Reviewers see it in their queues. |
| **Approved** | A change that has received all required approvals. Ready for implementation. |
| **Evidence** | Attachments that prove the change is safe to ship: PR links, test plans, rollback plans, runbooks, etc. |
| **Approvals** | Governance sign-offs. Each approval has an area (e.g., Finance, Billing Owner) and an approver. |
| **Revenue Impact Report** | An automated risk memo that summarizes failure modes, safeguards, and recommended approvers. |
| **Coordination Plan** | Suggestions for approvers, evidence, and notification routing based on domain, systems, and change type. |
| **Restricted Visibility** | Some changes are restricted. Only users explicitly granted access can see them. |

---

## 3. Navigating the Application

| Area | Purpose |
|------|---------|
| **Dashboard** | Your home view: My Approvals, In Review, Blocked, and Overdue. Quick access to what needs your attention. |
| **Reviews** | Central hub for review queues. Switch between My Approvals, In Review, Blocked, and Overdue. |
| **Search** | Find changes, systems, approvals, evidence, and users. Use the top-nav search bar or go to `/search` for full results. |
| **Changes** | View and manage changes. Create new changes or open existing ones. |
| **Signals** | Risk signals and learning. Useful for understanding how the system evaluates risk. |
| **Notifications** | In-app notifications for approvals, blockers, and updates. |
| **Settings** | Org settings, approval roles, mappings, domain permissions. Available to admins. |

### Quick Navigation

- **Create Change** — Click “New Change” or go to **Changes → Create Change**
- **My Approvals** — Dashboard or **Reviews** with view “My Approvals”
- **Search** — Use the search bar in the top nav or press **/** to focus it
- **Full search** — Type your query and press Enter to open the search results page

---

## 4. Creating a Change

1. Go to **Dashboard** or **Reviews** and click **New Change**, or navigate to **Changes → Create Change**.
2. Enter a **title** (e.g., “Stripe Pricing Logic Update”).
3. Select **change type** and **domain**.
4. Add **systems involved** (e.g., Stripe, Chargebee).
5. Complete the guided intake steps (see below).
6. Save as **Draft** and return later, or continue through to submit.

**Drafts**

- Only you (and admins/owners) see your draft until you submit.
- You can edit all intake fields, evidence, and approvals while in Draft.
- Drafts do not appear in reviewer queues until submitted.

---

## 5. Guided Intake Workflow

The intake workflow guides you through what the system needs to assess risk and route approvals.

### Intake Steps

1. **Systems** — Which systems does this change touch? (e.g., Stripe, NetSuite, HubSpot)
2. **Change Type** — What kind of change? (e.g., PRICING, BILLING, CRM_SCHEMA)
3. **Revenue Impact** — Which revenue areas are affected? (e.g., MRR/ARR, discounts, revenue recognition)
4. **Customer Impact** — Will customers be impacted? How?
5. **Rollout Strategy** — Phased, feature flag, big bang? Rollback estimate?
6. **Evidence** — Attach required evidence (PR, test plan, rollback plan, etc.)
7. **Approvals** — Ensure all required approvers are assigned
8. **Review & Submit** — Review everything and submit for review

### Readiness Indicators

- A **Ready for Submission** banner appears when all checks pass: required evidence, required approvals, no blockers.
- If something is missing (e.g., “PR required”, “Finance Reviewer required”), the banner shows what to fix.
- You can save partial progress and return later. The stepper shows which steps are done.

### Required vs Optional

- **Required** — Must be filled for submission (e.g., systems, domain, change type, required evidence, required approvals).
- **Optional** — Improves risk analysis but does not block submission (e.g., rollout method, rollback time estimate).

**Example:** For “Stripe Pricing Logic Update,” the system may require a PR, test plan, and Finance Reviewer approval before you can submit.

---

## 6. Coordination Autopilot

**What it does**

The Coordination Autopilot uses your org’s approval mappings to suggest approvers and evidence for a change. For example, if your change touches Stripe and the Finance domain, it may suggest:

- **Billing Owner** (from system mapping: Stripe → Billing Owner)
- **Finance Reviewer** (from domain mapping: REVENUE → Finance Reviewer)
- **Evidence:** PR, test plan, rollback plan

**How to use it**

1. On the change page, find the **Coordination Autopilot** card.
2. Click **Generate Coordination Plan** (or it may auto-generate during intake).
3. Review suggested approvers and evidence.
4. Click **Apply Approvers** or **Apply Evidence** to add them to the change.
5. Adjust if needed. You can add or remove approvers and evidence manually.

**Example scenario**

*Stripe pricing change → Finance Reviewer + Billing Owner suggested*

- Domain REVENUE maps to Finance Reviewer.
- System Stripe maps to Billing Owner.
- The autopilot suggests both. You click **Apply Approvers**, and both are queued as required approvals.

---

## 7. Revenue Impact Report

### What It Analyzes

The Revenue Impact Report is an automated risk memo for the change. It includes:

- **Risk level** — Low, Medium, High, Very High, or Critical
- **Executive summary** — Why this matters, worst outcome, what reduces risk
- **Failure modes** — Potential failure scenarios with severity and likelihood
- **Required safeguards** — Must-haves before approval
- **Recommended safeguards** — Best practices
- **Required approvals** — Who should sign off

### Risk Levels

| Level | Meaning |
|-------|---------|
| **Low** | Minimal revenue impact; standard checks. |
| **Medium** | Some impact; PR typically required. |
| **High** | Significant impact; PR + test plan. |
| **Very High** | High impact; PR + test plan + runbook + rollback plan. |
| **Critical** | Highest impact; full evidence set (PR, test plan, runbook, rollback, dashboard, comms plan). |

### Where to Find It

- On the change detail page, look for the **Revenue Impact Report** panel.
- Click **Generate Report** if it hasn’t been generated.
- After you edit the change, the report may be marked **stale**. Click **Regenerate** to refresh.

### Stale Reports

If you change systems, domain, or intake after the report was generated, it is marked **stale**. Regenerate the report so it reflects the current state.

---

## 8. Submitting for Review

### Steps

1. **Ensure readiness** — The banner should say “Ready for Submission.”
2. **Generate coordination plan** — Ensure approvers and evidence suggestions are applied.
3. **Resolve blockers** — Any coordination blockers (e.g., missing approval area) must be fixed.
4. Click **Submit for Review**.

### What Happens After Submission

- The change status becomes **In Review**.
- Approvers receive notifications.
- SLA due dates are set based on risk.
- The change appears in **My Approvals** for assigned reviewers and in **In Review** for others.

### If Submission Fails

- Check the readiness banner for missing evidence or approvals.
- Review coordination blockers.
- Ensure all required intake fields are complete.

---

## 9. Reviewing and Approving Changes

### Finding Your Approvals

- Go to **Dashboard** → **My Approvals**, or **Reviews** → view **My Approvals**.
- Changes awaiting your approval appear here.

### Review Workflow

1. Open the change.
2. Review the **Revenue Impact Report** (risk level, failure modes, safeguards).
3. Check **Evidence** — All required evidence must be present.
4. Read the change details, intake, and coordination summary.
5. Approve or reject.

### Approval Blockers

You cannot approve until:

- All required evidence is attached.
- You have reviewed the change and are satisfied it is safe to ship.

### Approving or Rejecting

- **Approve** — Records your approval. Other approvers may still be needed.
- **Reject** — Returns the change to the owner. Provide a reason so they can fix and resubmit.

---

## 10. Evidence Requirements

### Evidence Types

| Kind | Description |
|------|-------------|
| **PR / Change Diff** | Link to the code change or diff. |
| **Test Plan** | How you tested the change. |
| **Runbook / Release Plan** | Steps to deploy and verify. |
| **Rollback Plan** | How to revert if something goes wrong. |
| **Validation Dashboard** | Where to monitor post-deploy. |
| **Customer Comms Plan** | How customers will be informed. |
| **Other** | Any additional artifact. |

### Why Evidence Matters

Evidence proves the change is safe to ship. For billing changes, a rollback plan is especially important: if pricing breaks, you need a clear way to revert.

### Providing Evidence

1. On the change page, open the **Evidence** panel.
2. Click **Add Evidence**.
3. Choose the evidence kind (e.g., Rollback Plan).
4. Add a label and optional URL or notes.
5. Save.

### When Evidence Is Missing

- The readiness banner lists missing required evidence.
- The **Evidence** panel shows what is required for the current risk bucket.
- You can use **Suggest Evidence** (AI) to get ideas for what to attach, then add it manually.

**Example:** *Rollback plan required for billing changes* — For a change touching Stripe billing, the system may require a rollback plan. Add a link to a doc or note describing how to revert.

---

## 11. Notifications and Queues

### Queues

| Queue | Meaning |
|-------|---------|
| **My Approvals** | Changes where you are an assigned approver and your decision is pending. |
| **In Review** | All changes currently in review (across the org, within your visibility). |
| **Blocked** | Changes blocked by missing evidence or other governance issues. |
| **Overdue** | Changes past their SLA due date. |

### Notification Types

- Approval requests — You are assigned as an approver.
- Change submitted — A change you care about was submitted.
- Blockers — Evidence or approval blockers detected.
- Digest — Daily inbox or weekly summary (if enabled).

### Where They Appear

- **In-app** — Bell icon in the top nav.
- **Queues** — Dashboard and Reviews pages show counts and lists.
- **Slack / email** — If your org has configured these channels.

---

## 12. Search

### What You Can Search

- **Changes** — By title, description, change type, domain, systems, status, owner
- **Systems** — By system name
- **Approvals** — By change title, approver, approval area, status
- **Evidence** — By kind, title, notes
- **Users** — By name, email, role (admin workflows)

### How to Search

1. **Quick search** — Use the search bar in the top nav. Type at least 2 characters. Results appear grouped (Changes, Systems, Approvals, Evidence).
2. **Full search** — Press Enter or go to `/search?q=...` for the full search page with filters.
3. **Keyboard** — Press **/** to focus the search bar. Use arrow keys to move through results, Enter to open.

### Example Queries

- `stripe pricing` — Finds changes like “Stripe Pricing Logic Update”
- `billing overdue` — Finds billing-related or overdue items
- `NetSuite` — Finds changes touching NetSuite

See [SEARCH_PASS7.md](./SEARCH_PASS7.md) for technical details.

---

## See Also

- [ADMIN_GUIDE.md](./ADMIN_GUIDE.md) — Configuring approval roles, mappings, and domain permissions
- [EXECUTIVE_GUIDE.md](./EXECUTIVE_GUIDE.md) — Understanding dashboards and risk visibility
- [UAT_SEED_DATA.md](./UAT_SEED_DATA.md) — Demo personas and seeded sample changes
