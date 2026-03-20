# Phase 0 — UI Information Architecture

## Navigation

### Add or elevate

- Issues
- Integrations
- Changes
- Incidents
- Executive
- Settings

### De-emphasize

- Change-centric entry points as the sole backbone.

## Required Pages

### Issues index

- Operational home for all detected and active problems.
- Filters: source type, domain, severity, status, verification status.
- Sort: priority, impact, age, SLA, created.
- Saved views; quick counts (open, assigned, resolved pending verification, reopened).

### Issue detail

- Header: title, source, severity, owner, status, verification.
- Impact summary card; evidence panel; source panel; linked entities; linked changes; action/task panel; timeline/history; verification panel.

### Change detail updates

- Linked issues card; risk and issue lineage; governance-to-issue mapping.

### Integrations overview

- Connection health; last sync; monitoring coverage; blind spots; issue counts from integration.

### Executive dashboard

- Aggregate via issue model: revenue at risk, unresolved critical issues, verified wins, reopened after failed verification, top issue sources.

## Design

Keep existing enterprise UI (clean, modern, action-oriented). Phase 0 change is issue-first clarity, not visual reinvention.
