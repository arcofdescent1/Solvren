# Solvren AI Contract Margin Control

This isolated Next.js/Supabase application supports a paid contract-margin audit: verified organization accounts, MFA-protected Finance and Engineer roles, versioned contracts, metadata-only AI cost and outcome imports, customer mapping, supplier-statement coverage, a ranked portfolio, and source-level customer reports. It does not share data or credentials with the legacy Solvren application.

## Local development

Use Node.js 22 or newer, pnpm, Docker, and the Supabase CLI. Copy `.env.example` to `.env.local`, run `supabase start`, set the local URL/publishable/service-role keys from its output, then run `pnpm install` and `pnpm dev`. Set `APP_ORIGIN=http://localhost:3000`. Local invitation email is available in Supabase Inbucket; production invitations require `RESEND_API_KEY` and `INVITE_FROM_EMAIL` on a verified domain. A local worker call requires a random `CRON_SECRET` of at least 32 characters and `Authorization: Bearer <CRON_SECRET>` at `/api/internal/import-worker`.

The ordered SQL migrations create the application schema, policies, private Storage bucket, Vault-backed Langfuse secrets, and `pgmq` import queue. Do not run them against the legacy database.

## Production configuration

1. Create a dedicated Supabase project with Postgres 17 and apply every migration in `supabase/migrations` in order. Confirm `btree_gist`, `pgmq`, Vault, Auth, and Storage are available. Keep backups and exercise a database-plus-Storage restore before enrolling customers.
2. Set Supabase Auth's site URL and exact callback allowlist for `https://<app-domain>/auth/callback`. Configure production SMTP, Google and Azure OAuth, verified-email enforcement, TOTP, and the password/session settings described in `supabase/config.toml`. Azure must return an email claim. Session time-box controls require a Supabase plan that supports them.
3. Deploy this app over HTTPS with all variables in `.env.example`. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are browser-visible. `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, and Resend credentials must stay server-side. Use a fresh high-entropy `CRON_SECRET` of at least 32 characters. Restrict access to production environment variables and separate the production and preview Supabase projects.
4. Deploy `vercel.json` with the application root set to `apps/contract-margin`. Its import worker runs every minute; this schedule requires a Vercel plan that supports minute-level cron. Keep the worker's deployment runtime at or above its configured 60-second maximum. Monitor failed import jobs and worker HTTP failures. Review Auth, Storage, database, and worker logs without recording prompts, responses, ingestion keys, or connector secrets.
5. Invite an Owner, Finance, and Engineer. Enroll TOTP for privileged users. In **Data & imports**, Finance sets the default margin target and imports contracts and supplier statements; Engineer imports usage/outcomes/direct costs, configures mappings and rate cards, or connects a Langfuse v4 project. Open the portfolio and each customer report to verify the first 30-day result.

## Ingestion contract

Each CSV template is downloadable in **Data & imports**. A CSV contains 1–10,000 rows and is at most 4 MB. Contract and statement files are atomic: invalid rows reject the entire file. Event files queue valid rows and record invalid row numbers with downloadable reasons. The source ID is a stable namespace such as `application` or `billing_export`; source event IDs must remain stable across retries. Replaying an event does not add it twice. Unknown model costs remain unpriced, and unmapped events remain visible outside customer totals. The portfolio shows known contribution as an upper bound whenever costs are incomplete.

Engineers can create an MFA-protected ingestion key and send up to 500 metadata-only rows and 1 MB per request to `POST /api/ingest/events`. The JSON object contains `kind` (`usage`, `outcomes`, or `direct_costs`), `source`, and `rows`. Use the corresponding CSV template's camelCase field names in each JSON row. Include `Authorization: Bearer <key>` and `Content-Type: application/json`. A successful response is `202` with a job ID; inspect the job in **Data & imports**. An invalid batch returns `422` and queues no rows. Keys are shown once, can be revoked, are limited to 60 requests per minute each, and are automatically revoked when their creator leaves or loses an eligible role.

Langfuse connections are scoped to one provider and region. Solvren fetches Langfuse v2 observation fields for IDs, model, usage, cost, and trace context, without requesting prompt or response bodies. Backfills are checkpointed and resumable. Langfuse reported cost is used when present; otherwise effective-dated model rates calculate a cost from token buckets. Direct supplier statements are period-specific and non-overlapping. The report distinguishes observed cost from statement coverage and does not infer that missing cost is zero.

## Verification and release gate

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`. Automated local tests cover import validation and finance display. The SQL migrations were also executed against a disposable PostgreSQL 17 database with representative contract amendments, mapping/rate recalculation, retry deduplication, cross-tenant denial, margin overrides, and key revocation. That database used stand-ins for Supabase services; it does **not** certify a deployed Supabase environment.

Before admitting production users, run the following against the actual dedicated Supabase project and deployment: sign-up/email verification and Google/Azure login; invitation and TOTP role changes; direct cross-tenant SQL/API denial; Storage upload/download/cleanup; Vault connection and disconnect; `pgmq` retries and worker cron authorization; a Langfuse page with genuine credentials; API and CSV imports with invalid and duplicate rows; provider-statement overlap rejection; a real 30-day contract report reconciled to source files; and backup/restore. Resolve any failures before release. A build with placeholder public keys only proves compilation.
