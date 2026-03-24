# Service role (`createPrivilegedClient` / legacy `createAdminClient`) inventory

Every use bypasses RLS. **Pattern:** authenticate → resolve org + permission with SSR client → then open privileged client for the minimal operation.

| Area | Example routes / modules | Why service role | Replace with SSR? |
|------|--------------------------|------------------|---------------------|
| **Cron / scheduled** | `api/cron/*` | No user session | No — keep privileged; protect with `CRON_SECRET` |
| **Webhooks** | `api/billing/webhook`, `api/integrations/*/webhook` | Third-party callers, no JWT | No — verify signature, then privileged |
| **Notifications** | `api/notifications/process` | Cross-org delivery worker | Partial — enqueue with user context where possible |
| **Auth / SSO** | `api/auth/sso/*` | User provisioning, OIDC state | Partial — reads after session established |
| **Org directory** | `api/org/members`, invites | `auth.admin.getUserById` needs service role | Keep privileged after `org.users.manage` |
| **Integrations** | `api/integrations/*` (config, test, objects) | Encrypted credentials / provider APIs | Often keep for secrets; reads may move to RLS |
| **Changes workflow** | `api/changes/*` (submit, draft, intake, permissions) | Historical mix of RLS bypass | **Review:** prefer SSR + RLS first |
| **Admin / signals** | `api/admin/signals/*` | Bulk / cross-tenant tooling | Keep behind `admin.jobs.view` + auth |
| **Health** | `api/health` | DB ping without user | Keep for probes |
| **Demo** | `api/demo/*` | Seeding | Dev-only; gate in production |
| **Workers** | `src/workers/*`, jobs under `src/modules/**` | Background | Keep privileged |
| **GitHub / Jira services** | `src/services/jira/*` | Sync writebacks | Keep after action auth |

**Engineering rule:** new code must call `createPrivilegedClient("<route>: <one-line why>")` with an explicit reason string.

Last reviewed: Phase 0 implementation (automated list — reconcile in PR review).
