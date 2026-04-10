# Solvren Canonical Surface Map

Use this as the single reference for canonical UI routes and API families. Before adding new pages or APIs, check this map and follow the established patterns.

---

## 1. Org Admin / Settings

| Feature | Canonical UI Route | Canonical API Family | Notes |
|---------|--------------------|----------------------|-------|
| Org settings hub | `/org/settings` | `/api/org/*` | Billing, Slack, digest, bootstrap |
| Organization form | `/settings/organization` | `/api/org/settings` | |
| Domain settings | `/settings/domains` | `/api/settings/domains` | Enable domains, SLA per domain |
| Domain permissions | `/settings/domain-permissions` | `/api/settings/domain-permissions` | RBAC visibility |
| Approval roles | `/settings/approval-roles` | `/api/settings/approval-roles` | |
| Approval mappings | `/settings/approval-mappings` | `/api/settings/approval-mappings` | Trigger → role routing |
| Users / invites | `/settings/users` | `/api/org/members`, `/api/org/invites` | |

**Deprecated / supplementary**

| Route | Replacement | Notes |
|-------|-------------|-------|
| `/settings/admin/approval-role-map` | `/settings/approval-mappings` for routing; this page for AI label mapping only | Maps AI labels (e.g. "Finance") to approval areas. Keep for AI report generation; not in main nav. |

**Redirects**

| Old | New |
|-----|-----|
| `/settings` | `/org/settings` |
| `/admin` | `/admin/jobs` |

---

## 2. Change Workflow

| Old | New |
|-----|-----|
| `/changes/new` | Redirects to `/intake/new` (Phase 3) |

| Feature | Canonical UI Route | Canonical API Family |
|---------|--------------------|----------------------|
| Change detail | `/changes/[id]` | `/api/changes/[id]/*` |
| New intake | `/intake/new` | `/api/intake`, `/api/changes/draft`, `/api/changes/submit` |
| Change intake | `/changes/[id]/intake` | `/api/changes/[id]/intake` |
| Revenue impact report | (panel on change detail) | `/api/changes/[id]/revenue-impact`, `/api/changes/[id]/revenue-impact/generate` |
| Coordination plan | (panel on change detail) | `/api/changes/[id]/coordination-plan` |

**Deprecated API**

| Route | Replacement |
|-------|-------------|
| `GET /api/changes/[id]/impact-report/latest` | Redirects (308) to `GET /api/changes/[id]/revenue-impact` |

---

## 3. Queues & Reviews

| Feature | Canonical UI Route | Canonical API Family |
|---------|--------------------|----------------------|
| Reviews | `/reviews` | `/api/reviews/*` |
| My approvals | `/queue/my-approvals` | `/api/approvals/*` |
| In review | `/queue/in-review` | `/api/reviews/inbox` |
| Blocked | `/queue/blocked` | |
| Overdue | `/queue/overdue` | |

---

## 4. Executive / Reporting

| Feature | Canonical UI Route | Canonical API Family |
|---------|--------------------|----------------------|
| Executive overview | `/executive` | `/api/executive/summary` |
| Executive revenue | `/executive/revenue` | `/api/executive/revenue-summary` |

---

## 5. Jobs & Cron

| Feature | Canonical UI Route | Canonical API Family |
|---------|--------------------|----------------------|
| Job runner (manual triggers) | `/admin/jobs` | `/api/admin/jobs/trigger` |
| SLA tick | — | `POST /api/sla/tick` |
| Notifications process | — | `POST /api/notifications/process` |
| Daily inbox | — | `POST /api/inbox/daily/run` |
| Weekly digest | — | `POST /api/digests/weekly/run` |

`/api/admin/trigger-sla-tick` and `/api/admin/jobs/trigger` are admin UI proxies that call the canonical job endpoints with `CRON_SECRET`. Use them from the app; use canonical endpoints from cron/scheduler.

---

## 6. Admin (Platform)

| Feature | Canonical UI Route | Canonical API Family |
|---------|--------------------|----------------------|
| Domain builder | `/admin/domains` | `/api/admin/domains` |
| Ops inbox | `/ops` | `/api/ops-inbox/*` |

---

## 7. Route Conventions

- **UI:** `/settings/<feature>`, `/queue/<queue>`, `/changes/[id]`, `/admin/<area>`
- **API:** `/api/settings/*` for org settings, `/api/admin/*` for platform admin, `/api/changes/*` for change workflows
- **Terminology:** Use "Revenue Impact Report" (not "Impact Report"), "Approval Mappings" (not "Approval Role Map" for trigger routing)
