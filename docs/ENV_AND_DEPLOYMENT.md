# Environment and Deployment

## Environment variables

### Policy

- **`.env.local`** — Use for local development. Never commit this file.
- **`.env.example`** — Checked in. Documents every variable; copy to `.env.local` and fill in values.
- **Real secrets** — Never committed. Production secrets live in Vercel (or your host) and Supabase dashboard.
- **Rotation** — If a secret was ever committed (e.g. in history), rotate it immediately in Supabase/Stripe/Slack and update the deployment.

### Public vs server-only

- **Public (client-safe):** Only variables prefixed with `NEXT_PUBLIC_` are exposed to the browser.  
  Examples: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Server-only:** Everything else is server-only. Never prefix a secret with `NEXT_PUBLIC_`.  
  Examples: `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `SLACK_CLIENT_SECRET`, `CRON_SECRET`.

### Canonical names

Use one name per concept:

- **App:** `APP_URL` (not `APP_BASE_URL` or `NEXT_PUBLIC_APP_URL`)
- **Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Stripe:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_TEAM`, `STRIPE_PRICE_BUSINESS`
- **Slack:** `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`, `SLACK_BOT_TOKEN`, `SLACK_REDIRECT_URI`, `SLACK_STATE_SECRET`
- **Cron:** `CRON_SECRET`
- **Email:** `RESEND_API_KEY`, `EMAIL_FROM` (legacy: `RESEND_FROM`), `SECURITY_REQUEST_RECIPIENT` (Trust Center security request form)

### Required to boot

The app **requires** these to start:

- `APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional (feature-dependent):

- Stripe — if billing is enabled
- Slack — if Slack integration is enabled
- `CRON_SECRET` — if cron routes are called
- Resend / `EMAIL_FROM` — if transactional email is used

### Server-side access

Server code should use the shared env helper so missing required vars fail at startup:

```ts
import { env } from "@/lib/env";

// Required (validated)
const url = env.appUrl;
const supabaseUrl = env.supabaseUrl;

// Optional
const stripeKey = env.stripeSecretKey;
const cronSecret = env.cronSecret;
```

Client code (browser) must use `process.env.NEXT_PUBLIC_*` only; Next.js inlines these at build time.

## Deployment

- **Local:** Copy `.env.example` to `.env.local`, set `APP_URL=http://localhost:3000` and Supabase vars.
- **Staging / Production:** Set all variables in your host (e.g. Vercel project settings). Do not commit `.env.production` or any file containing secrets.
