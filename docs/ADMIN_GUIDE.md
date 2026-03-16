# Solvren Admin Guide

A guide for organization owners, admins, governance leads, and operations leaders who configure governance.

---

## Table of Contents

1. [Organization Setup](#1-organization-setup)
2. [User Roles](#2-user-roles)
3. [Domain Permissions](#3-domain-permissions)
4. [Approval Roles](#4-approval-roles)
5. [Approval Role Mapping](#5-approval-role-mapping)
6. [Systems Catalog](#6-systems-catalog)
7. [Evidence Policies](#7-evidence-policies)
8. [Notification Settings](#8-notification-settings)

---

## 1. Organization Setup

### Configuring Org Settings

1. Go to **Settings** (or **Org Settings**).
2. Edit organization name, notification emails, and other settings.
3. Ensure domains are enabled (e.g., REVENUE, SECURITY) as needed for your governance model.

### Inviting Users

1. Go to **Settings → Users** (or **Organization → Members**).
2. Invite users by email.
3. Assign a role: Owner, Admin, Submitter, Reviewer, or Viewer.
4. Users receive an invite link and join the org after acceptance.

### Assigning Roles

When inviting or editing a member, select the appropriate role. See [User Roles](#2-user-roles) for what each role can do.

**Example:** For the Acme Revenue Ops demo org, Olivia Owner (owner) manages the org, Sophie Submitter (submitter) creates changes, and Fiona Finance (reviewer) approves finance-domain changes.

---

## 2. User Roles

| Role | Capabilities |
|------|--------------|
| **Owner** | Full control: org settings, billing, delete org, all admin functions. Cannot be demoted if they are the last owner. |
| **Admin** | Manage users, approval roles, approval mappings, domain permissions, systems. Access admin and ops surfaces. Cannot change billing or delete org. |
| **Submitter** | Create changes, submit for review. View changes they have access to. No admin access. |
| **Reviewer** | Everything a Submitter can do, plus approve changes (when assigned). View queues and approvals. |
| **Viewer** | Read-only access to changes and dashboards within their visibility. Cannot create, submit, or approve. |

### Role Hierarchy

- **Owner** > **Admin** > **Reviewer** > **Submitter** > **Viewer**
- Admins and Owners can access Settings and configure governance.
- Submitters and Reviewers use the product; Reviewers also approve.

---

## 3. Domain Permissions

### What Domains Represent

Domains are governance categories (e.g., REVENUE, SECURITY, FINANCE). Each change has a domain. Domain permissions control who can **view** and who can **review** changes in that domain.

### Configuring Domain-Level Visibility

1. Go to **Settings → Domain Permissions**.
2. For each user (or role), set:
   - **View** — Can see changes in this domain
   - **Review** — Can be assigned as an approver for this domain

### How It Affects Access

- **Finance domain** → Only users with Finance view/review can see or approve finance changes.
- **Security domain** → Security reviewers see security changes; others may not.
- Users without domain permission do not see changes in that domain (including in search and queues).

**Example:** Fiona Finance has REVENUE and FINANCE view+review. Sophie Submitter has REVENUE view only. Sophie can see REVENUE changes but cannot approve them. Fiona can view and approve both REVENUE and FINANCE changes.

---

## 4. Approval Roles

### What Approval Roles Are

Approval roles are named responsibilities (e.g., Finance Reviewer, Billing Owner, Security Reviewer). Users are assigned to roles. When a change needs an approval from “Finance Reviewer,” the system routes it to the user(s) in that role.

### Managing Approval Roles

1. Go to **Settings → Approval Roles**.
2. Create or edit roles (e.g., Finance Reviewer, Billing Owner, Data Reviewer).
3. Assign users to each role. A role can have multiple members.

### Examples

| Role | Purpose |
|------|---------|
| **Finance Reviewer** | Approves changes affecting revenue, billing, or finance. |
| **Security Reviewer** | Approves security-sensitive changes. |
| **Billing Owner** | Approves changes to billing systems (Stripe, Chargebee, etc.). |
| **Data Reviewer** | Approves data/schema changes. |
| **Revenue Leadership** | Executive sign-off for high-impact changes. |

**Seeded example:** In the Acme demo, Finance Reviewer → Fiona Finance, Security Reviewer → Sam Security, Billing Owner → Adam Admin, Data Reviewer → Riley Reviewer.

---

## 5. Approval Role Mapping

### What Mapping Does

Approval role mappings connect **triggers** (domain, system, or change type) to **approval roles**. The Coordination Autopilot uses these mappings to suggest approvers for each change.

### Mapping Rules

| Trigger Type | Trigger Value | Approval Role |
|--------------|---------------|---------------|
| DOMAIN | REVENUE | Finance Reviewer |
| DOMAIN | SECURITY | Security Reviewer |
| SYSTEM | Stripe | Billing Owner |
| CHANGE_TYPE | PRICING | Revenue Leadership |
| CHANGE_TYPE | BILLING | Billing Owner |

### How to Configure

1. Go to **Settings → Approval Mappings**.
2. Add a mapping: choose trigger type (Domain, System, Change Type), trigger value, and approval role.
3. Save. The Coordination Autopilot will use these when generating plans.

### How Mappings Influence Coordination Autopilot

When a change has:

- **Domain REVENUE** → Finance Reviewer is suggested
- **System Stripe** → Billing Owner is suggested
- **Change type PRICING** → Revenue Leadership is suggested

Multiple mappings can apply; the autopilot suggests all matching roles.

See [USER_GUIDE.md — Coordination Autopilot](./USER_GUIDE.md#6-coordination-autopilot) for how submitters use these suggestions.

---

## 6. Systems Catalog

### How Systems Are Used

Systems (e.g., Stripe, Chargebee, NetSuite, HubSpot) are referenced in change intake. The system catalog informs:

- **Risk signals** — Billing systems like Stripe add financial exposure signals
- **Approval mappings** — System: Stripe → Billing Owner
- **Coordination** — Multi-system changes get extra coordination suggestions

### Recommended Systems to Register

Common revenue-impacting systems:

| System | Typical Use |
|--------|-------------|
| **Stripe** | Payments, subscriptions, billing |
| **Chargebee** | Subscription billing |
| **Zuora** | Revenue management |
| **NetSuite** | ERP, revenue recognition |
| **HubSpot** | CRM, marketing |
| **Salesforce** | CRM, pipeline |
| **Okta** | Auth (security-sensitive changes) |

### Managing Systems

- Systems can be configured at the org level (Settings → Domains or admin surfaces).
- When users create a change, they select from available systems.
- Approval mappings can target specific systems for routing.

---

## 7. Evidence Policies

### Evidence Kinds

The system supports these evidence kinds:

- PR / Change Diff  
- Test Plan  
- Runbook / Release Plan  
- Rollback Plan  
- Validation Dashboard  
- Customer Comms Plan  
- Other  

### When Evidence Is Required

Evidence requirements are driven by **risk bucket** (LOW, MEDIUM, HIGH, VERY_HIGH, CRITICAL):

| Bucket | Required Evidence |
|--------|-------------------|
| LOW | None |
| MEDIUM | PR |
| HIGH | PR, Test Plan |
| VERY_HIGH | PR, Test Plan, Runbook, Rollback Plan |
| CRITICAL | PR, Test Plan, Runbook, Rollback Plan, Dashboard, Comms Plan |

Domain governance templates can override these for specific domains.

### How Evidence Enforces Governance

- Submitters cannot submit until required evidence is attached (unless overridden by policy).
- Reviewers see missing evidence as a blocker.
- The system enforces discipline so high-risk changes are not approved without proof.

See [USER_GUIDE.md — Evidence Requirements](./USER_GUIDE.md#10-evidence-requirements) for how users provide evidence.

---

## 8. Notification Settings

### Org-Level Notification Routing

- Configure where notifications go: in-app, email, or Slack.
- Set default recipients for approvals, blockers, and digests.

### Slack / Email Configuration

If your org uses Slack:

- Install the Solvren Slack app and link the workspace.
- Map users to Slack IDs for @mentions.
- Configure channels for approval requests or digests.

Email notifications use the user’s registered email. Notification templates can be customized at the org level where supported.

### Daily Inbox and Weekly Digest

- **Daily inbox** — Summarizes changes needing attention (approvals, blocked, overdue).
- **Weekly digest** — Broader summary of activity.
- Enable or disable per org. Configure run schedules if you use cron/webhooks.

---

## See Also

- [USER_GUIDE.md](./USER_GUIDE.md) — How users create changes, use Coordination Autopilot, and approve
- [EXECUTIVE_GUIDE.md](./EXECUTIVE_GUIDE.md) — Executive dashboards and risk visibility
- [UAT_SEED_DATA.md](./UAT_SEED_DATA.md) — Demo personas, approval roles, mappings, and domain permissions
