# Scheduled Jobs and Background Workers

---

## Job endpoints

| Job | Endpoint | Schedule (Vercel) | Purpose |
|-----|----------|-------------------|---------|
| SLA tick | `POST /api/sla/tick` | Every 5 min | Evaluate SLA state, escalate overdue, enqueue notifications |
| Notifications process | `POST /api/notifications/process` | Every 2 min | Deliver outbox items (in-app, Slack, email) |
| Slack deliveries | `POST /api/integrations/slack/deliveries/process` | Every 2 min | Process slack_message_deliveries (IES pipeline) |
| Daily inbox | `POST /api/inbox/daily/run` | Daily 13:00 UTC | Generate daily inbox digests |
| Weekly digest | `POST /api/digests/weekly/run` | Mondays 14:00 UTC | Generate weekly digests |

---

## Authentication

All job routes require `CRON_SECRET`:

- Header: `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret: <CRON_SECRET>`
- Vercel Cron sends it automatically when configured in project env

---

## Idempotency

- **SLA tick**: Evaluates state, updates records; re-running applies same transitions (idempotent).
- **Notifications process**: Processes PENDING outbox rows, marks SENT/FAILED; retries use attempt_count and available_at.
- **Daily inbox / Weekly digest**: Uses dedupe_key and date keys; re-running same day does not duplicate.

---

## Logging

Each job logs:

- `job completed` (or equivalent) with counts: `scanned`, `processed`, `errors`
- `logError` on failures

---

## Schedule verification

For each environment:

| Environment | Trigger |
|-------------|---------|
| Local | Manual: `curl -X POST .../api/sla/tick -H "Authorization: Bearer $CRON_SECRET"` |
| Staging | Vercel Cron or external scheduler |
| Production | Vercel Cron (see `vercel.json`) |
