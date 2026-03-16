# Production Readiness Runbook (Task 22)

This guide is the operational checklist for staging and production confidence.

## 1) Required observability

- Error tracking: Sentry enabled with `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`.
- Health endpoint: `GET /api/health` must return `healthy` or `degraded`.
- Structured logging: critical jobs and API failures log JSON with route/job context.

## 2) CI/CD gates

Every PR and main push must pass:

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`
4. `npm run test`
5. `npm run test:e2e`
6. `npm run storybook:build`

Branch protection recommendation:

- Require all checks above before merge.
- Block direct pushes to `main`.
- Require at least one approving review.

## 3) Staging validation flow

Before promoting to production:

1. Deploy to staging.
2. Run DB migrations on staging (`supabase db push`).
3. Validate environment (`/api/health`).
4. Trigger jobs from `Admin Jobs` page:
   - Notifications processor
   - SLA tick
   - Daily inbox
   - Weekly digest
5. Execute smoke checks:
   - Auth login + forgot-password
   - Draft -> submit flow
   - Approval decision flow
   - Search + queue visibility
   - Restricted visibility behavior

### E2E execution modes

- `npm run test:e2e` runs the Playwright suite in baseline mode (safe in CI).
- `E2E_FULL=1 npm run test:e2e` runs full workflow scenarios against seeded auth/org data.
- `PLAYWRIGHT_VISUAL=1 npm run test:e2e` enables visual snapshot specs.

## 4) Release smoke checklist

Use this checklist for every production release:

- [ ] CI checks all green.
- [ ] Migrations reviewed and applied in staging first.
- [ ] `/api/health` returns `healthy` in production.
- [ ] `CRON_SECRET` configured in deployment environment.
- [ ] Slack/Stripe/Resend env vars set where applicable.
- [ ] Admin Jobs page loads and manual trigger works.
- [ ] Notification outbox failed count acceptable.
- [ ] Regression smoke completed on core workflow.

## 5) Incident response quick steps

If production workflow failures are reported:

1. Check Sentry issues for the route/job error signature.
2. Check `Admin Jobs` metrics (`PENDING`, `PROCESSING`, `FAILED` outbox counts).
3. Retry failed notifications via Ops table.
4. Verify `CRON_SECRET` and scheduler status.
5. Roll back deployment if core path is blocked and no quick fix is possible.

## 6) Migration discipline

- Migrations must be forward-safe and idempotent where possible.
- Staging migration success is required before production.
- Never manually patch production schema without follow-up migration.

## 7) Secret hygiene

- Never commit secrets.
- Keep local/staging/prod secrets separated.
- Rotate any secret that was exposed in logs/history.
