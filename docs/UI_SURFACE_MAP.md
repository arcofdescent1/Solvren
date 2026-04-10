# Solvren – UI Surface Map

Version: 1.0  
Purpose: Ensure 100% feature coverage in UI and prevent functional drift during UI refactors.

---

# 1. Canonical Navigation Structure

This is the authoritative information architecture for Solvren. All major functionality must be reachable from this structure.

## Core

- Dashboard → /dashboard
- Reviews → /reviews
- Signals → /signals
- Notifications → /notifications

## Workflows

- New intake → /intake/new (`/changes/new` redirects here)
- Change Details → /changes/[id] (linked from tables only)

## Reporting

- Executive Overview → /executive
- Executive Revenue → /executive/revenue

## Settings

- Org Settings → /org/settings
- Domain Settings → /settings/domains
- Domain Permissions → /settings/domain-permissions
- Approval Roles → /settings/approval-roles
- Approval Mappings → /settings/approval-mappings
- Approval role map (AI labels) → /settings/admin/approval-role-map (org settings link only)

## Admin (Role Gated)

- Ops Inbox → /ops
- Domain Builder → /admin/domains

## System (Not in Sidebar)

- Landing → /
- Login → /login
- Onboarding → /onboarding

---

# 2. Drift Prevention Rules

The following are enforced:

- No raw HTML elements outside /src/ui/**
- No arbitrary Tailwind values
- No hard-coded colors
- No spacing utilities outside layout primitives
- All pages must use PageHeader + Card layout pattern
- All major routes must be reachable from Sidebar

---

# 3. UI Completeness Checklist

Before any release:

- [ ] Every route above renders without error
- [ ] Every route is reachable via navigation or drilldown
- [ ] Every API route is surfaced via a UI action
- [ ] No design lint violations
- [ ] Dark mode renders correctly for golden pages
