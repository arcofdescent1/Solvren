# UAT Test Matrix

| Area | Test(s) | Requires | Pass | Fail | Blocked |
|------|---------|----------|------|------|---------|
| **Health** | `GET /api/health` | — | ✓ | | |
| **Auth** | Login page, invalid creds | — | | | ✓* |
| **Auth** | Login as submitter/viewer/reviewer/owner | Seed, schema | | | ✓* |
| **Navigation** | `/`, `/login`, `/dashboard`, `/admin/jobs` | Schema, prod build | | | ✓* |
| **Integration platform** | Health API, Jira page | Schema, auth | | | ✓* |
| **Notifications retry** | POST blocks unauthenticated | — | | | ✓* |
| **Change governance** | Intake, approval, evidence | Full schema, seed | | | ✓* |
| **Jira integration** | Live Jira tenant | Staging config | | | — |
| **Slack integration** | Live Slack workspace | Staging config | | | — |

\* Blocked when: schema not at repo parity, or pages time out (use production build + local Supabase).

## Test File Mapping

| File | Coverage |
|------|----------|
| `tests/workflows.spec.ts` | Health, admin auth, notifications retry |
| `tests/auth.spec.ts` | Login, protected routes, personas |
| `tests/integration-platform.spec.ts` | Integration health API, Jira settings page |
| `tests/notifications.spec.ts` | Notifications page |
| `tests/approval-flow.spec.ts` | Approval workflow |
| `tests/change-intake.spec.ts` | Change intake |
| `tests/rbac.spec.ts` | RBAC |
| `tests/restricted-visibility.spec.ts` | Restricted changes |

## Unblocking Tests

1. **Schema parity**: Use local Supabase (`supabase start`, `supabase db reset`).
2. **Page timeouts**: Run Playwright against production build (config default).
3. **Integration tests**: Set `SKIP_INTEGRATION_TESTS=1` or configure Jira/Slack staging.
