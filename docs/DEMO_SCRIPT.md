# Solvren — 3-Minute Product Demo Script

A repeatable short demo for beta recruitment, investor discussions, and product demos. Flows from problem to solution in ~3 minutes.

---

## Demo Overview

| Step | Focus | Time |
|------|-------|------|
| 1 | Introduce the problem | ~30 sec |
| 2 | Create a change | ~45 sec |
| 3 | Coordination Autopilot | ~45 sec |
| 4 | Revenue Impact Report | ~30 sec |
| 5 | Approval workflow | ~30 sec |
| 6 | Executive dashboard | ~20 sec |

**Total:** ~3 minutes

---

## Step 1 — Introduce the Problem (~30 sec)

**Script:**

> Revenue system changes are some of the highest-risk changes organizations make. Billing, pricing, revenue recognition—a single error can cause double-billing, broken reporting, or compliance issues.
>
> Today these changes are often coordinated across Slack threads, Jira tickets, and spreadsheets. That creates confusion about who needs to review a change, what evidence is required, and whether safeguards are in place.
>
> Solvren fixes that by bringing it all into one system of record.

---

## Step 2 — Show Creating a Change (~45 sec)

**Actions:**

1. Click **New Change**
2. Enter title: *Stripe Pricing Logic Update*
3. Select domain: **REVENUE**
4. Add systems: **Stripe**, **Chargebee**
5. Select change type: **PRICING**

**Script:**

> Solvren guides you through structured intake. We capture the essential information: which systems, which domain, what type of change.
>
> This structured data drives everything that follows—risk analysis, approval routing, and coordination.

---

## Step 3 — Show Coordination Autopilot (~45 sec)

**Actions:**

1. Open the change detail
2. Find **Coordination Autopilot** section
3. Click **Generate Coordination Plan**
4. Show suggested approvers (Billing Owner, Finance Reviewer)
5. Show suggested evidence (PR, test plan, rollback plan)
6. Click **Apply Approvers** or **Apply Evidence** (optional, if time)

**Script:**

> Based on the systems and domain, the system automatically suggests who needs to approve. Because we selected Stripe, it suggests the Billing Owner. Because we selected REVENUE, it suggests the Finance Reviewer.
>
> It also suggests the right evidence—a PR, test plan, rollback plan—based on risk level. One click applies these. No more figuring out who to loop in or what to attach.

---

## Step 4 — Show Revenue Impact Report (~30 sec)

**Actions:**

1. Scroll to **Revenue Impact Report** panel
2. Click **Generate Report**
3. Show risk level (e.g., High)
4. Point to failure modes and safeguards
5. Optionally show executive summary

**Script:**

> Solvren analyzes the potential impact of the change. Here we see the risk level, possible failure modes—like incorrect pricing or double-billing—and required safeguards.
>
> This gives reviewers and executives a shared view of risk before anything ships.

---

## Step 5 — Show Approval Workflow (~30 sec)

**Actions:**

1. Submit the change (or switch to a seeded IN_REVIEW change if demoing live)
2. Open **My Approvals** as reviewer (or use Riley/Fiona persona)
3. Open a pending change
4. Show evidence and report in context
5. Click **Approve**

**Script:**

> Reviewers see the full context—evidence, risk analysis, coordination summary—before approving. Nothing gets approved without the right safeguards in place.
>
> The approval is recorded and traceable. Full audit trail.

---

## Step 6 — Show Executive Dashboard (~20 sec)

**Actions:**

1. Navigate to **Executive** or **Dashboard**
2. Show Revenue at Risk, critical change count
3. Point to In Review, Blocked, Overdue

**Script:**

> Executives see risk and operational status in real time. How much revenue is in flight. Which changes are critical. What's blocked or overdue.
>
> No more surprises. Full visibility.

---

## Demo Wrap-Up

**Closing script:**

> Solvren turns ad-hoc coordination into a systematic process. Structured intake, automated coordination, risk analysis, governance visibility—all in one place.
>
> If you'd like to see how it fits your workflow, we can set up a pilot.

---

## Demo Tips

- **Use seeded data** when possible: "Stripe Pricing Logic Update" and "Billing Reconciliation Patch" are strong demo candidates. See [UAT_SEED_DATA.md](./UAT_SEED_DATA.md).
- **Pre-generate** coordination plan and Revenue Impact Report before the demo to avoid wait time.
- **Switch personas** (Sophie → Riley → Olivia) to show different views without leaving the flow.
- **Keyboard shortcut** — Press `/` to demonstrate search.
