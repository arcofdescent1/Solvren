# Environment Configuration

This document describes how Solvren validates and uses environment variables.

---

## Startup validation

Required variables are validated at server startup (in `instrumentation.ts`). If any are missing, the server will fail to start with a clear error.

To skip validation (e.g. for CI build without env): set `SKIP_ENV_VALIDATION=1`. The app will still fail at runtime when required vars are first used.

**Required (Category A):**

| Variable | Purpose |
|----------|---------|
| `APP_URL` | Base URL of the app (e.g. `http://localhost:3000`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |

---

## Optional integrations (Category B)

When an optional integration is **not** configured, the feature is disabled. The system starts, and API routes return 503 with a clear message if the feature is requested.

| Integration | Required vars | Flag | Behavior when disabled |
|-------------|---------------|------|-------------------------|
| **AI** | `OPENAI_API_KEY` | `env.aiEnabled` | AI routes return 503; Revenue Impact Report falls back to rules-only |
| **Billing** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_TEAM`, `STRIPE_PRICE_BUSINESS` | `env.billingEnabled` | Billing routes return 503 |
| **Slack** | `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`, `SLACK_BOT_TOKEN` | `env.slackEnabled` | Slack install returns 500; notifications skip Slack |
| **Email** | `RESEND_API_KEY`, `EMAIL_FROM` | `env.emailEnabled` | Invites and email notifications skip email channel |

---

## Integration status

`GET /api/health` returns `integrations: { ai, billing, slack, email }` so you can verify configuration at runtime.

---

## No placeholder secrets

Placeholder values like `sk-placeholder-for-build` or `sk_test_placeholder_for_build` are **removed**. Missing keys mean the integration is disabled. Never commit real secrets.

---

## Callback URLs

| Variable | When used |
|----------|-----------|
| `APP_URL` | Used to build callback URLs for auth, Stripe, Slack |
| Supabase Auth | Configure Redirect URLs in Supabase dashboard to match `APP_URL` |
| Slack | `SLACK_REDIRECT_URI` or default `{APP_URL}/api/integrations/slack/callback` |
