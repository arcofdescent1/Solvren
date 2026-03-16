# Solvren Deployment Guide

This runbook lets a new engineer clone the repo, configure the stack, run migrations, bootstrap data, run the app locally, and deploy to staging or production without tribal knowledge. For a repeatable **clean-room validation** path and checklist (Phase 1 proof), see **§11 Clean-room validation**.

---

## 1. Overview

**Solvren** is a Next.js application for structured change governance: intake, risk assessment, approvals, evidence, incidents, and notifications. It helps teams track revenue-impacting changes through review, evidence, and delivery (in-app, Slack, email).

**What it does:**

- Change requests with domain (e.g. Revenue), risk scoring, and approval workflows
- Evidence checklists and approval areas (e.g. Finance, Legal)
- Notification outbox (in-app, Slack, optional email via Resend)
- SLA tracking and escalation
- Optional Stripe billing (TEAM/BUSINESS plans) and Slack integration
- Org invitations: admins invite by email and role; invitees accept via a time-limited link (email sent via Resend when configured)

---

## 2. Architecture

| Component | Role |
|-----------|------|
| **Next.js app** | App router, API routes, server and client components |
| **Supabase** | Postgres database, Auth (email), RLS |
| **Supabase migrations** | Schema and seed data in `supabase/migrations/` |
| **Stripe** | Billing (optional): checkout, portal, subscription webhook |
| **Slack** | Notifications and approval actions (optional) |
| **Scheduled jobs** | SLA tick, notification outbox, weekly digest, daily inbox, signal stats, learning recompute |
| **Resend** | Transactional email (optional) |
| **Sentry** | Error monitoring (optional) |

There is **no separate backend**. All server logic lives in Next.js API routes and server components. Cron-style jobs are HTTP endpoints called by Vercel Cron or an external scheduler with `CRON_SECRET`.

---

## 3. Prerequisites

Install and have accounts for:

| Requirement | Notes |
|-------------|--------|
| **Node.js 20+** | LTS recommended |
| **npm 10+** | Or equivalent (pnpm/yarn) |
| **Git** | To clone the repo |
| **Supabase CLI** | For migrations and optional local Supabase ([install](https://supabase.com/docs/guides/cli)) |
| **Vercel account** | For hosting (or another Node host) |
| **Supabase project** | Create at [supabase.com](https://supabase.com) |
| **Stripe account** | Required only if billing is enabled |
| **Slack app** | Required only if Slack integration is enabled |

---

## 4. Clone and install

```bash
git clone <repo-url>
cd Solvren
npm install
```

Use the `main` branch unless your team specifies another. No other branches are required for a standard deploy.

---

## 5. Environment variables

Copy the example file and fill in values. **Never commit `.env.local`** or any file containing real secrets. Production secrets belong in your hosting provider (e.g. Vercel) and in Supabase.

```bash
cp .env.example .env.local
```

Edit `.env.local`. Reference: `.env.example` and `docs/ENV_AND_DEPLOYMENT.md`.

### Required for local boot

| Variable | Description |
|----------|-------------|
| `APP_URL` | Base URL of the app (e.g. `http://localhost:3000` locally) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (Settings → API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only; never expose to client) |

### Optional for local

| Variable | When needed |
|----------|-------------|
| `CRON_SECRET` | Required when calling cron/job routes (outbox, digest, inbox, learning, etc.) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_TEAM`, `STRIPE_PRICE_BUSINESS` | When billing is enabled |
| `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`, `SLACK_BOT_TOKEN`, `SLACK_REDIRECT_URI`, `SLACK_STATE_SECRET` | When Slack is enabled |
| `RESEND_API_KEY`, `EMAIL_FROM` | When transactional email is used |
| `OPENAI_API_KEY` | For AI checklist/suggestions |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` | For monitoring |

Rules:

- **Never commit** `.env.local` or any env file that contains secrets.
- Production: set all variables in Vercel (or your host) project settings, not in the repo.

---

## 6. Supabase setup

1. Create a project at [app.supabase.com](https://app.supabase.com).
2. In the dashboard: **Settings → API**:
   - Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - Copy **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret)
3. (Optional) To run migrations via CLI, link the repo to the project:
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   ```
   Project ref is in the Supabase dashboard URL or under **Settings → General**.

This project does **not** use local Supabase by default. You can use a hosted project for both local and production, or separate projects for staging/production.

**Email verification (required for signup):** Enable **Confirm email** in Supabase: **Authentication → Providers → Email → Confirm email**. Set **Site URL** (e.g. `http://localhost:3000` or your production URL) under **Authentication → URL Configuration**. Add your app’s callback to **Redirect URLs**, e.g. `http://localhost:3000/auth/callback` and `https://<your-domain>/auth/callback`. For the “Confirm signup” email template, use a link that hits the app so the server can exchange the token: e.g. `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email`. Then users who sign up receive a verification email and must click the link before they can create orgs or use protected workflows.

**Password reset:** Uses Supabase’s built-in reset flow. **Redirect URLs** must include the reset destination for each environment, e.g. `http://localhost:3000/auth/reset-password`, `https://staging.example.com/auth/reset-password`, and `https://app.example.com/auth/reset-password`. For a consistent server-side session, set the “Reset password” email template link to `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery` so the app callback exchanges the token and redirects to `/auth/reset-password` with the session in cookies. **Site URL** must match the app origin (local, staging, or production) so reset emails point to the correct host.

**Redirect URL validation:** Before going live, confirm that (1) **Site URL** in Supabase matches the app’s base URL for that environment, (2) every environment’s reset and callback URLs are listed under **Redirect URLs**, and (3) a test reset from each environment delivers an email whose link lands on the same environment (e.g. local reset → link opens in local app; production reset → link opens in production app). Wrong host or missing redirect URLs are the most common cause of broken reset flows.

---

## 7. Database migrations

Migrations live in **`supabase/migrations/`**. Apply them with the Supabase CLI against a linked project.

**Apply migrations to the linked remote project:**

```bash
supabase db push
```

**If you use local Supabase** (e.g. `supabase start`):

```bash
supabase db reset
```

`db reset` applies all migrations and can reset the DB; use only in local/dev. For staging and production, use **`supabase db push`** (or your CI/CD migration step). Seeds are not run automatically by these commands; bootstrap is done via the app (see next section).

---

## 8. Seed / bootstrap data

There is **no** `npm run seed` script. A usable state is created through the app and one API:

1. **Sign up** – Create a user via the app (Supabase Auth).
2. **Create organization** – On first login you are sent to onboarding; create an org (calls `POST /api/org/create`).
3. **Bootstrap defaults** – After org creation, the onboarding flow calls `POST /api/org/bootstrap`. You can also run bootstrap from **Org Settings** (Solvren bootstrap panel). Bootstrap seeds for that org:
   - Signal definitions and mitigations (REVENUE domain)
   - Approval requirements and related defaults

To get a **test org** and **test user**:

1. Run the app (see below), open `http://localhost:3000`, sign up with an email.
2. Complete onboarding (create organization). Bootstrap runs automatically after create.
3. Optionally add another user and invite them to the org (if your product supports it).

No manual SQL seed step is required for a minimal usable state.

---

## 9. Run locally

```bash
npm run dev
```

- **App URL:** [http://localhost:3000](http://localhost:3000)
- Successful startup: Next.js compiles and the dev server listens on 3000. Opening the URL should show the app (login or dashboard depending on auth).

Ensure `APP_URL=http://localhost:3000` and the four required Supabase variables are set in `.env.local`; otherwise the app will fail when those values are first used.

---

## 10. Local validation checklist

After startup, verify:

1. **Auth** – Sign up or sign in works.
2. **Onboarding** – If new user, org creation and redirect work.
3. **Dashboard** – Loads after login; shows “Dashboard” and any quick links.
4. **New change** – Can create a new change from the UI (e.g. New Change).
5. **Change detail** – Can open a change, see status and basic metadata.
6. **Submit for review** – Change can be submitted (if your flow supports it).
7. **Reviews** – Reviews/ops inbox page loads; filters or tabs work.
8. **Evidence / approvals** – On a change, evidence checklist and approval areas appear where configured.
9. **Notifications** – Notifications page loads (and outbox processor runs if cron is configured).
10. **Org Settings** – Org settings and Solvren bootstrap panel load; bootstrap can be run again safely (idempotent).
11. **Team & invites** – Org admins can open **Settings → Team & invites** (`/settings/users`), invite by email and role, and invitees can accept via the link in the email (requires RESEND_API_KEY and EMAIL_FROM for invite emails).

If billing is enabled: run through checkout and portal once. If Slack is enabled: connect workspace and send a test notification.

---

## 11. Clean-room validation (Phase 1 proof)

This section is the **repeatable proof** that a clean clone can install, migrate, bootstrap, and run the baseline workflow. Use it before releases or when bringing up a new environment (e.g. fresh laptop, new staging).

### Canonical bootstrap sequence

From a clean clone, run this sequence. There is **no** `npm run seed`; bootstrap is done in the app after first signup.

**Using a linked remote Supabase project (typical):**

```bash
git clone <repo-url>
cd Solvren
npm install
cp .env.example .env.local
# Edit .env.local: set APP_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
supabase link --project-ref <your-project-ref>
supabase db push
npm run dev
```

Then in the browser: open `http://localhost:3000` → **Sign up** (create a user) → complete **onboarding** (create organization). Bootstrap runs automatically after org creation. You now have one test org and one test user.

**Using local Supabase** (if you run `supabase start`):

```bash
# After supabase start
supabase db reset
npm run dev
```

Again, bootstrap = sign up → create org in onboarding (no separate seed command).

### Env validation

Confirm that env handling is real, not theoretical.

- **Test A — Missing env failure:** Comment out or remove one required var in `.env.local` (e.g. `NEXT_PUBLIC_SUPABASE_URL`). Start the app (`npm run dev`) and trigger a code path that needs it (e.g. load a page that uses Supabase). You should see a clear error such as:
  - `Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL`
- **Test B — Successful boot:** Restore the var and start the app. It should boot without that error; home or auth page loads.

### Clean Install Validation Checklist

Use this as an actual checklist when validating a clean install or before a release.

#### Environment

- [ ] `npm install` completes successfully
- [ ] `.env.local` created from `.env.example`
- [ ] App fails clearly when a required env var is missing (Test A)
- [ ] App boots successfully when required env vars are present (Test B)

#### Database

- [ ] `supabase db push` (remote) or `supabase db reset` (local) completes successfully
- [ ] Migrations apply cleanly; no schema or policy errors

#### Bootstrap

- [ ] No `npm run seed`; bootstrap = sign up + create org in onboarding
- [ ] After signup and onboarding, a usable test org exists
- [ ] After signup, a usable test user exists and can access the app

#### App startup

- [ ] `npm run dev` starts successfully
- [ ] Home page loads
- [ ] Auth (login/signup) flow loads
- [ ] Protected routes redirect or render correctly after login

#### Core product flow

- [ ] User can access an organization (dashboard or org-scoped page)
- [ ] User can create a change
- [ ] User can submit a change for review
- [ ] Approvals are visible where expected
- [ ] Evidence requirements are visible where expected

#### Jobs

Invoke each route with `Authorization: Bearer <CRON_SECRET>` (or `x-cron-secret`). Set `CRON_SECRET` in `.env.local` for local testing.

- [ ] `POST /api/sla/tick` returns success (e.g. `{ "ok": true, "scanned": ..., "transitioned": ..., "errors": ... }`)
- [ ] `POST /api/notifications/process` returns success
- [ ] `POST /api/inbox/daily/run` returns success
- [ ] `POST /api/digests/weekly/run` returns success

Example (replace `<CRON_SECRET>` and base URL if needed):

```bash
curl -sS -X POST http://localhost:3000/api/sla/tick -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### If something fails during clean install

Fix the foundation before moving on. Common failure classes:

| Failure class | Symptoms | Action |
|--------------|----------|--------|
| **Migration drift** | relation/policy already exists, table missing, reset fails halfway | Fix migration chain; do not proceed until reset/push is reliable |
| **Seed/bootstrap fragility** | Manual setup still required, bootstrap assumes existing data | Make bootstrap path deterministic or document manual steps explicitly |
| **Hidden env assumptions** | Undocumented var required, startup crash from undefined | Add var to `.env.example`, strengthen `src/lib/env.ts` |
| **Broken background jobs** | Cron routes 401, route crashes on empty data, duplicate inserts | Stabilize job auth and idempotency |
| **Auth/bootstrap mismatch** | Signup works but no org; protected routes fail after login | Normalize bootstrap path (onboarding → org create → bootstrap) |

Record any defects found in a fix list and address before Phase 2.

---

## 12. Stripe setup (optional)

Used for TEAM/BUSINESS plans and billing.

**Required env vars:**

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_TEAM` – Stripe Price ID for TEAM plan
- `STRIPE_PRICE_BUSINESS` – Stripe Price ID for BUSINESS plan

**Steps:**

1. In Stripe Dashboard create Products/Prices for TEAM and BUSINESS; copy the Price IDs into env.
2. Create a webhook endpoint pointing to your **production** (or staging) base URL:
   - **URL:** `https://<your-domain>/api/billing/webhook`
3. Subscribe to events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.

**Local testing:** Use Stripe CLI to forward webhooks to `http://localhost:3000/api/billing/webhook` and use the CLI’s signing secret in `.env.local`.

---

## 13. Slack setup (optional)

Used for notifications and approval actions in Slack.

**Required env vars:**

- `SLACK_CLIENT_ID`
- `SLACK_CLIENT_SECRET`
- `SLACK_SIGNING_SECRET`
- `SLACK_BOT_TOKEN` (obtained after OAuth install)
- `SLACK_REDIRECT_URI` – e.g. `https://<your-domain>/api/integrations/slack/callback` (optional if same as default)
- `SLACK_STATE_SECRET` – A secret string used to sign OAuth state

**Steps:**

1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps).
2. **OAuth & Permissions:** Redirect URL: `https://<your-domain>/api/integrations/slack/callback`.
3. **Bot scopes:** `chat:write`, `channels:read`. **User scopes:** `users:read`.
4. Copy **Client ID** and **Client Secret** into env.
5. **Basic Information → App Credentials:** copy **Signing Secret** → `SLACK_SIGNING_SECRET`.
6. Install the app to the workspace; copy the **Bot User OAuth Token** → `SLACK_BOT_TOKEN`.
7. Set `SLACK_STATE_SECRET` to any secure random string (used for OAuth state HMAC).

Redirect URL must **exactly** match the deployed app URL (including path `/api/integrations/slack/callback`).

---

## 14. Scheduled jobs / cron

Solvren’s background work runs as scheduled HTTP jobs. **Every** job route requires `CRON_SECRET` via `Authorization: Bearer <CRON_SECRET>` or header `x-cron-secret: <CRON_SECRET>`. Set `CRON_SECRET` in your Vercel project environment variables; when set, Vercel Cron automatically sends it as a Bearer token when invoking cron routes.

### Core job inventory (wired in `vercel.json`)

| Job | Route | Frequency | Purpose |
|-----|-------|-----------|---------|
| SLA Tick | `POST /api/sla/tick` | Every 5 min | Evaluate review SLAs; transition due/overdue/escalated; enqueue SLA notifications |
| Notifications Process | `POST /api/notifications/process` | Every 2 min | Deliver outbox items (in-app, Slack, email); retry/backoff; mark sent or failed |
| Daily Inbox | `POST /api/inbox/daily/run` | Daily 13:00 UTC | Enqueue daily inbox summaries into `notification_outbox` (delivery by notifications job) |
| Weekly Digest | `POST /api/digests/weekly/run` | Weekly Mon 14:00 UTC | Enqueue weekly digest items into `notification_outbox` (delivery by notifications job) |

All four are defined in `vercel.json`. Inbox and digest jobs **enqueue** only; the notifications job **delivers**. Dedupe keys prevent duplicate daily inbox or weekly digest rows when cron runs overlap.

### Optional / on-demand job routes

These also require `CRON_SECRET` but are not in `vercel.json`; run on-demand or from an external scheduler if needed:

| Route | Purpose |
|-------|---------|
| `POST /api/cron/evaluate-sla` | Evaluate SLA (RPC) |
| `POST /api/cron/compute-signal-stats` | Compute signal statistics |
| `POST /api/cron/signal-stats/recompute` | Full signal stats recompute |
| `POST /api/cron/risk/model/bump` | Risk model version bump |
| `POST /api/risk/recompute` | Recompute risk for an org |

### Response shape and logging

Job routes return JSON with `ok: true` and operational counts (`scanned`, `processed`, `enqueued`, `errors`). Failures are logged with `console.error` (and can be wired to Sentry later).

---

## 15. Deploy to staging / production (Vercel)

1. Create a Vercel project and connect the repository.
2. **Environment variables:** In project settings, add every variable from `.env.example` that you use (required + optional for billing/Slack/email/cron). Set `APP_URL` to the production (or staging) URL, e.g. `https://your-app.vercel.app`.
3. Deploy (e.g. push to `main` or trigger deploy from Vercel).
4. **Database:** Run migrations against the production Supabase project (`supabase link` to prod project, then `supabase db push`), or run migrations in CI if you have that pipeline.
5. **Cron:** All four core jobs are in `vercel.json` (sla/tick, notifications/process, inbox/daily/run, digests/weekly/run). Set `CRON_SECRET` in Vercel project env so Vercel Cron can authenticate when invoking them.
6. **Stripe:** Set production webhook URL to `https://<your-domain>/api/billing/webhook` and use the production webhook signing secret in env.
7. **Slack:** Set OAuth redirect URL to `https://<your-domain>/api/integrations/slack/callback`.
8. Run through the post-deploy checklist below.

---

## 16. Post-deploy validation checklist

After deployment, verify:

- [ ] App loads over HTTPS at `APP_URL`.
- [ ] Login and sign-up work (Supabase Auth).
- [ ] Org creation (onboarding) works.
- [ ] Protected routes (dashboard, reviews, settings) load when logged in.
- [ ] Create a change and submit for review; approval/evidence areas appear.
- [ ] Notifications page loads; run `POST /api/notifications/process` with `CRON_SECRET` and confirm outbox is processed (or check logs).
- [ ] If billing is on: Stripe checkout and portal work; webhook receives events (check Stripe Dashboard).
- [ ] If Slack is on: Connect workspace and send a test notification; approval actions work.
- [ ] Audit log or key actions are recorded as expected.
- [ ] No critical errors in Vercel (and Sentry if configured).

---

## 17. Troubleshooting

### Missing required environment variable

- Error: `Missing required environment variable: APP_URL` (or Supabase vars).
- **Fix:** Ensure `.env.local` (local) or Vercel env (production) has the exact names from `.env.example`. The app validates on first use of each required var.

### Supabase link or push fails

- **Fix:** Run `supabase login` and `supabase link --project-ref <ref>`. Ensure the ref matches the project. For `db push`, the linked project must have network access and correct credentials.

### Migration failures

- **Fix:** Run migrations in order; fix any failing migration SQL before re-running. Check Supabase logs for constraint or permission errors.

### Stripe webhook signature invalid

- **Fix:** `STRIPE_WEBHOOK_SECRET` must match the secret for the webhook endpoint in Stripe Dashboard. For local testing, use Stripe CLI’s secret.

### Cron returns 401 Unauthorized

- **Fix:** Call the job URL with `Authorization: Bearer <CRON_SECRET>` or header `x-cron-secret: <CRON_SECRET>`. Ensure `CRON_SECRET` in the app matches the value used by the scheduler.

### Slack OAuth redirect mismatch

- **Fix:** In Slack app, OAuth redirect URL must be exactly `https://<your-domain>/api/integrations/slack/callback` (no trailing slash, correct domain). Update `APP_URL` and Slack app URL to match.

### Stripe price ID not found or wrong plan

- **Fix:** `STRIPE_PRICE_TEAM` and `STRIPE_PRICE_BUSINESS` must be the Stripe Price IDs (e.g. `price_xxx`) for the plans you use. Check Products/Prices in Stripe and env vars.

### Bootstrap already seeded

- **Fix:** Bootstrap is idempotent. If the org is already seeded, the API returns `alreadySeeded: true`. No action needed.

---

For env and canonical variable names, see **`docs/ENV_AND_DEPLOYMENT.md`**.
