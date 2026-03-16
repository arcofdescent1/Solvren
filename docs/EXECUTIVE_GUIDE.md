# Solvren Executive Guide

A guide for CFOs, revenue operations leadership, operations executives, and engineering leadership.

---

## Table of Contents

1. [What Solvren Solves](#1-what-Solvren-solves)
2. [Key Executive Capabilities](#2-key-executive-capabilities)
3. [Understanding the Dashboard](#3-understanding-the-dashboard)
4. [Evaluating Change Risk](#4-evaluating-change-risk)
5. [Governance Visibility](#5-governance-visibility)
6. [Operational Benefits](#6-operational-benefits)

---

## 1. What Solvren Solves

### Revenue-Impacting System Risk

Changes to billing, pricing, CRM, and integrations carry real financial risk. A single misconfiguration can cause:

- Double-billing or under-billing
- Incorrect revenue recognition
- Broken reporting and forecasting
- Customer-facing pricing errors

Solvren surfaces risk before changes ship and ensures evidence and approvals are in place.

### Coordination Overhead

Without a central system, coordination is ad hoc: who approves? what evidence is needed? Solvren:

- Automates approver routing from domain and system rules
- Suggests evidence based on risk level
- Keeps a clear audit trail

### Lack of Visibility

Executives often lack visibility into:

- Which changes are in flight
- How much revenue is at risk
- What is blocked or overdue
- Who approved what

Solvren provides dashboards and reports so you can see risk and governance status at a glance.

---

## 2. Key Executive Capabilities

| Capability | What It Does |
|------------|--------------|
| **Revenue Impact Reports** | Automated risk memos per change: failure modes, safeguards, required approvals. Gives reviewers and execs a shared view of risk. |
| **Coordination Autopilot** | Suggests approvers and evidence from your governance rules. Reduces manual coordination and ensures consistency. |
| **Evidence Enforcement** | Required artifacts (PR, test plan, rollback plan, etc.) by risk level. Prevents approval without proof. |
| **Approval Governance** | Domain- and system-based routing. Finance changes get Finance Reviewer; Stripe changes get Billing Owner. |
| **Risk Visibility Dashboards** | Executive summary, Revenue at Risk, critical change counts, overdue items, and top risk drivers. |

---

## 3. Understanding the Dashboard

The main dashboard and review queues give you an operational view.

### My Approvals

Changes where you (or your delegates) are assigned as approvers and a decision is pending. Reviewers use this as their primary queue.

### In Review

All changes currently in the review pipeline. Shows volume and where work is concentrated.

### Blocked

Changes that cannot progress because of missing evidence or approval blockers. These need attention before they can be approved.

### Overdue

Changes past their SLA due date. Indicates coordination or capacity issues that may need escalation.

**Operational meaning:** High overdue counts suggest reviewers are overloaded or evidence is slow to arrive. Blocked counts show governance friction. Executives can use these to prioritize support and process improvements.

---

## 4. Evaluating Change Risk

### Risk Levels

| Level | Meaning |
|-------|---------|
| **Low** | Minimal revenue impact. Standard checks. |
| **Medium** | Some impact. PR typically required. |
| **High** | Significant impact. PR + test plan. |
| **Very High** | High impact. PR + test plan + runbook + rollback plan. |
| **Critical** | Highest impact. Full evidence set and executive awareness. |

### Failure Modes

The Revenue Impact Report lists potential failure scenarios for each change, with severity and likelihood. Use these to understand:

- Worst reasonable outcome
- What reduces risk most
- Whether safeguards are adequate

### Safeguards

- **Required** — Must be in place before approval (e.g., rollback plan for billing changes).
- **Recommended** — Best practices that improve safety.

### Evidence Completeness

Before approval, required evidence must be attached. Executives can trust that high-risk changes are not approved without proof (PR, test plan, rollback plan, etc.).

**Example:** “Stripe Pricing Logic Update” might be High risk. The report shows failure modes (incorrect pricing, double-billing), required safeguards (test plan, rollback plan), and required approvals (Finance Reviewer, Billing Owner). Reviewers see the same view and cannot approve until evidence is complete.

---

## 5. Governance Visibility

### Approval Traceability

Every approval is recorded: who approved, when, and for which approval area. You can see the full chain of sign-offs for any change.

### Audit Timeline

The change timeline shows:

- Submission
- Coordination plan generation
- Approvals and rejections
- Evidence additions
- Status changes

Use this for audits, post-incident review, or compliance.

### Restricted Visibility

Some changes are restricted. Only users with explicit access can see them. Counts and summaries do not leak restricted content. This supports sensitive or compliance-heavy work.

---

## 6. Operational Benefits

| Outcome | How Solvren Helps |
|---------|-------------------------|
| **Reduced coordination overhead** | Coordination Autopilot suggests approvers and evidence. Less back-and-forth to figure out who signs off. |
| **Faster approvals** | Clear queues, evidence requirements, and Revenue Impact Reports give reviewers what they need to decide quickly. |
| **Reduced incident risk** | Evidence enforcement and risk visibility reduce the chance that risky changes ship without proper checks. |
| **Institutional knowledge capture** | Evidence, reports, and audit trails stay with the change. New team members can understand past decisions. |
| **Scalable governance** | Approval mappings and domain permissions scale with your org. Add systems and domains without rebuilding process. |

---

## Executive Summary Page

The **Executive** page (`/executive`) provides:

- **Executive narrative** — High-level summary of current risk and activity
- **Revenue at Risk (MRR)** — Sum of estimated MRR from unapproved changes
- **Critical changes** — Count of changes needing exec attention
- **High + Critical** — Count of risky changes in flight
- **Overdue / Escalated** — Items past SLA
- **By Revenue Surface** — Breakdown by surface (e.g., Subscriptions, One-time)
- **Top Risk Drivers** — Most common risk signals across changes
- **Revenue page** — Additional revenue-focused metrics and views

Use this page for weekly reviews, board prep, or operational check-ins.

---

## See Also

- [USER_GUIDE.md](./USER_GUIDE.md) — How users create changes, use Coordination Autopilot, and approve
- [ADMIN_GUIDE.md](./ADMIN_GUIDE.md) — Configuring approval roles, mappings, and domain permissions
- [UAT_SEED_DATA.md](./UAT_SEED_DATA.md) — Demo data and sample changes for executive demos
