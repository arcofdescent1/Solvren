# Solvren Admin Guide

A guide for organization owners, admins, governance leads, security stakeholders, and operations leaders who configure Solvren.

Last updated: 2026-06-17

---

## 1. Admin Responsibilities

Admins configure the parts of Solvren that make revenue protection work:

- connected systems
- team access
- user roles
- decision rules
- approval mappings
- proof expectations
- restricted access
- support access
- security controls
- license scope
- diagnostics

Most admin work now lives under **Setup**.

---

## 2. Current Setup Model

Solvren setup is designed to feel simple first:

1. Connect systems
2. Choose what to protect
3. Invite decision makers
4. See the first risk or protected value

Advanced controls remain available, but they should not be required before the product can show value.

---

## 3. Team And Access

Use **Setup -> Team & access** to invite users and manage roles.

Roles:

| Role | Capabilities |
|------|--------------|
| **Owner** | Full organization access, including license, security, users, and setup. |
| **Admin** | Manage setup, users, integrations, rules, and diagnostics. |
| **Submitter** | Create and submit changes. |
| **Reviewer** | Review and approve assigned decisions. |
| **Viewer** | View permitted records without managing settings. |

Users can manage their own display name and profile picture. Avatars appear throughout the app so ownership is easier to recognize.

---

## 4. Connected Systems

Use **Setup** to connect systems Solvren should watch or work with.

Common systems include:

- Stripe or other billing systems
- Salesforce or HubSpot
- Jira or GitHub
- NetSuite
- Snowflake or BigQuery
- PostgreSQL or MySQL

Connection health should be shown in plain language such as "connected", "needs attention", or "protection active".

---

## 5. Decision Rules

Decision rules tell Solvren when work needs approval, proof, or follow-up.

Admins can configure:

- approval roles
- approval mappings
- domain permissions
- attention routing
- proof and evidence expectations
- notification settings

Approval roles represent business responsibility, such as Finance, Billing Owner, Engineering Lead, Revenue Operations, Product, or Security.

---

## 6. Restricted Access

Restricted records are visible only to:

- owners and admins with appropriate access
- the creator
- assigned approvers
- explicitly granted users

Use restricted access for sensitive finance, security, personnel, or customer-impacting records.

---

## 7. Enterprise Trust Controls

Enterprise setup may include:

- SSO
- customer-controlled support access
- write-back defaults
- audit coverage
- license scope
- demo workspace behavior
- diagnostics and operational health

Demo workspaces are mostly read-only, but profile updates are allowed so demo users can personalize the workspace.

---

## 8. Proof And Auditability

Admins should ensure high-impact workflows produce proof:

- required proof before approval
- approval history
- delivery logs
- outcome verification
- value stories
- proof packets
- audit logs

The goal is not to expose internal complexity to every user. The goal is to make leadership value obvious while keeping full auditability available.

---

## 9. See Also

- [User Guide](./USER_GUIDE.md)
- [Executive Guide](./EXECUTIVE_GUIDE.md)
- [Beta Program](./BETA_PROGRAM.md)
