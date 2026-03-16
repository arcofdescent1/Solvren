# Staging Environment Parity Checklist

Use this to ensure staging behaves like production before release.

---

## Environment parity

- [ ] Staging uses production-like env variable set (sandbox keys for Stripe, test Slack app, etc.)
- [ ] `APP_URL` matches staging domain
- [ ] All required vars from `.env.example` are set
- [ ] Integration flags (`aiEnabled`, `billingEnabled`, etc.) match intended staging config

---

## Scheduled jobs

- [ ] Vercel Cron (or external scheduler) triggers job endpoints for staging
- [ ] `CRON_SECRET` is set and matches what the scheduler sends
- [ ] Jobs run successfully: `/api/sla/tick`, `/api/notifications/process`, `/api/integrations/slack/deliveries/process`, `/api/inbox/daily/run`, `/api/digests/weekly/run`

---

## Migrations

- [ ] Clean install: `supabase db push` (or equivalent) applies all migrations
- [ ] No migration failures or conflicts
- [ ] Application starts successfully after migrations

---

## Observability

- [ ] Integration failures are logged (check logs for `logError` output)
- [ ] Job failures are logged
- [ ] Auth failures are logged
- [ ] External API failures (Stripe, Slack, Resend, OpenAI) are visible in logs
