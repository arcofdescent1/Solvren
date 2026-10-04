# Solvren AI Contract Margin Control

This application is the isolated Next.js and Supabase implementation of Solvren's AI contract-margin product. Phase 0 covers verified accounts, Google and Microsoft sign-in, organization creation, four roles, expiring emailed invitations, member removal, ownership transfer, TOTP MFA, session controls, tenant isolation, metadata-only usage validation, and encrypted connector-credential storage. The customer-margin features begin in the subsequent product phases.

## Run locally

Use Node.js 22 or newer and pnpm. Copy `.env.example` to `.env.local`, start a local Supabase stack with `supabase start`, and enter its project URL and publishable key. Configure `APP_ORIGIN=http://localhost:3000`. Set `RESEND_API_KEY` and `INVITE_FROM_EMAIL` to a verified sending identity to deliver invitations. Then run:

```sh
pnpm install
pnpm dev
```

`supabase/config.toml` enables email confirmation, 12-character minimum passwords, TOTP, refresh-token rotation, and a seven-day/24-hour session time box for local development. The migrations create a separate data model; do not apply them to the legacy revenue-governance database.

## Production configuration

Use a dedicated Supabase project for the new product. Apply the migrations in `supabase/migrations` through a reviewed CI deployment, then configure its Auth site URL and allowed redirect URL for `https://<app-domain>/auth/callback`. Enable Google and Azure OAuth with their credentials and Supabase callback URLs; Azure must provide an email claim. Enable email confirmation and production SMTP delivery, disable anonymous users, enforce a password minimum of at least 12 characters, enable TOTP enrollment and verification, set a seven-day maximum session lifetime and 24-hour inactivity timeout, and keep JWT expiry at one hour or less. Supabase's session time-boxing controls require a plan that supports them.

Set the six environment variables in `.env.example` in the Next.js hosting environment. The publishable key is browser-safe; Resend credentials stay server-side. Configure `INVITE_FROM_EMAIL` on a domain verified by Resend. Keep the legacy product's Supabase project and keys separate. The app does not use a service-role key for its account routes; privileged membership changes are checked inside Postgres functions and require an authenticated, verified user with the correct organization role and MFA level.

The production deployment must serve HTTPS. Limit the Supabase Auth redirect allowlist to the deployed app's callback route and the environments that need it. Test a restore of both Postgres and any Storage objects before the later data-import phase is released.

## Verification

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Before exposing the app to customers, execute the Phase 0 acceptance flow against the dedicated Supabase project: verify a new work email, sign in with Google and Microsoft, create two organizations, enroll TOTP for an Owner, invite Finance/Engineer/Viewer users, reject a mismatched or expired invite, change and remove a member with a fresh code, transfer ownership atomically, sign out all devices, and confirm both browser and direct API/database access to another organization's rows fail. The metadata validator must reject prompt or response content; connector credentials must never be returned by a customer API or stored in plaintext.

The implementation is kept separate from the existing legacy app in the same repository so the old route tree and migrations cannot accidentally expose new financial data. Once the complete AI-margin product is ready, the public Solvren routing can switch to this application.
