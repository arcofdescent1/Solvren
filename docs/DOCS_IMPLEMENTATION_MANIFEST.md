# Docs Implementation Manifest & Patch Plan

This document is the single-pass manifest and patch plan for the docs expansion pass (8 new pages, analytics adapter, role shortcuts).

---

## Part 1 — New Files Added

| Path | Purpose |
|------|---------|
| `content/docs/guides/change-workflow.mdx` | Change lifecycle from draft through approval |
| `content/docs/guides/reviewer-guide.mdx` | Reviewer responsibilities and decision flow |
| `content/docs/guides/dashboard-and-queues.mdx` | Dashboard, queues, visibility by role |
| `content/docs/guides/search-and-notifications.mdx` | Search and notification behavior |
| `content/docs/admin/organization-settings.mdx` | Org defaults, timezone, SLA, digests |
| `content/docs/admin/approval-roles.mdx` | Approval roles and governance coverage |
| `content/docs/security/evidence-enforcement.mdx` | Required evidence and approval blocking |
| `content/docs/architecture/notifications-and-jobs.mdx` | Background jobs and notification model |
| `src/components/docs/DocsAnalyticsProvider.tsx` | Analytics adapter (PostHog, Segment, GA4, dev log) |

---

## Part 2 — Existing Files Updated

| Path | Change |
|------|--------|
| `src/lib/docs/getDocsNav.ts` | Added `"Guides"` to `SECTION_ORDER` |
| `src/app/docs/layout.tsx` | Import and mount `DocsAnalyticsProvider` |
| `src/components/docs/index.ts` | Export `DocsAnalyticsProvider` |

---

## Part 3 — Supporting Files (Already Present)

| Path | Status |
|------|--------|
| `src/lib/docs/getRoleShortcuts.ts` | Present; used by docs homepage for role shortcuts |
| `src/lib/docs/docsAnalytics.ts` | Present; `trackDocsEvent()` dispatches `Solvren:docs-analytics` |

---

## Part 4 — Optional Content Updates (Existing MDX)

Add `tags`, `roles`, and `lastUpdated` to these files if not already present:

- `content/docs/get-started/index.mdx`
- `content/docs/get-started/setup.mdx`
- `content/docs/get-started/first-change.mdx`
- `content/docs/guides/user-guide.mdx`
- `content/docs/admin/organization-setup.mdx`
- `content/docs/admin/users-roles.mdx`
- `content/docs/admin/approval-mappings.mdx`
- `content/docs/admin/domain-permissions.mdx`
- `content/docs/security/rbac.mdx`
- `content/docs/security/restricted-visibility.mdx`
- `content/docs/security/auditability.mdx`
- `content/docs/uat/seed-data.mdx`
- `content/docs/uat/test-scripts.mdx`
- `content/docs/architecture/overview.mdx`
- `content/docs/architecture/revenue-impact-report.mdx`
- `content/docs/architecture/coordination-autopilot.mdx`
- `content/docs/faq.mdx`
- `content/docs/releases.mdx`

---

## Implementation Order

1. Add the new MDX pages (done)
2. Add `getRoleShortcuts.ts` (already exists)
3. Update docs types and loader if needed
4. Update `/docs` homepage to show role shortcuts (already wired)
5. Add `DocsAnalyticsProvider`
6. Mount analytics provider in docs layout
7. Add/update metadata in existing docs pages (optional)
8. Verify search with expanded content
9. Smoke test page rendering and nav order

---

## Definition of Done

- [x] 8 new docs pages exist and render
- [x] Docs homepage includes role-based shortcuts
- [x] Docs pages support tags/chips and last-updated metadata
- [x] Docs analytics events forwarded through adapter layer
- [x] Docs layout mounts the analytics provider
- [ ] Smoke test: search and nav work with expanded content set

---

## Recommended Next Steps

1. Replace placeholder screenshots with real product screenshots from the seeded dataset
2. Do one content-editing pass for tone and consistency
