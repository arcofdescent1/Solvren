# Solvren V1 Test Plan - E2E Mapping

This document maps the V1 Test Plan test cases to the automated E2E specs.

## Spec Files

| Spec File | Plan Suites | Notes |
|-----------|-------------|-------|
| `suite-a-auth-onboarding.spec.ts` | A (Auth) | TC-AUTH-002 through TC-AUTH-005 |
| `suite-b-navigation.spec.ts` | B (Navigation) | TC-NAV-001 through TC-NAV-003 |
| `suite-e-f-change-approval.spec.ts` | E, F (Change, Approval) | TC-CHANGE-001/004/005, TC-APP-001/002/004 |
| `suite-i-k-dashboard-reports.spec.ts` | I, K (Dashboard, Reports) | TC-DASH-001/002, TC-REPORT-001 |
| `suite-j-risk-investigation.spec.ts` | J (Risk) | TC-RISK-INV-001, TC-RISK-INV-002 |
| `suite-c-d-integrations.spec.ts` | C, D (Jira, Slack) | TC-JIRA-001, TC-SLACK-001. Skip with SKIP_INTEGRATION_TESTS=1 |
| `suite-l-n-health-audit.spec.ts` | L, N (Health, Audit) | TC-HEALTH, TC-AUDIT-001 |
| `suite-edge-cases.spec.ts` | Edge | TC-EDGE-001, TC-EDGE-004 |
| `rbac.spec.ts` | M (RBAC) | TC-RBAC-001 through TC-RBAC-004 |
| `auth.spec.ts` | A (partial) | Login, invalid creds, personas |
| `shell.spec.ts` | B (partial) | Shell ownership |
| `approval-flow.spec.ts` | F (partial) | Reviewer queues |
| `change-intake.spec.ts` | E (partial) | Draft creation |
| `api-auth.spec.ts` | Security | API blocks unauthenticated |
| `integration-platform.spec.ts` | Integration | Provider health API. Skip with SKIP_INTEGRATION_TESTS=1 |

## Running Tests

```bash
# Full suite (requires seed)
npm run seed
npm run test:e2e

# Smoke only (skip Jira/Slack integration tests)
npm run test:e2e:smoke
```

## Not Yet Automated

- TC-AUTH-001: Register new org (requires signup flow)
- TC-JIRA-002 through TC-JIRA-007: OAuth flow, project selection (live Jira)
- TC-SLACK-002 through TC-SLACK-004: OAuth, channel config (live Slack)
- TC-CHANGE-002/003: Jira link, evidence requirements (partial)
- Suite G (Slack approval): Requires live Slack
- Suite H (Jira webhook): Requires live Jira
- TC-REPORT-003/004: PDF/CSV export (manual or separate)
- TC-HEALTH-002 through TC-HEALTH-004: Failure injection scenarios
- TC-E2E-001: Full sellable flow (combination of above)
