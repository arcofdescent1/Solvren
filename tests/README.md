# E2E Tests

Playwright tests run against a production build. They require a **Supabase instance** (migrations applied) and **UAT seed data** so login and workflow tests can run.

## Environment

1. **`.env.local`** with:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

2. **Seed**: Before the first test run, **globalSetup** runs `npm run seed` so UAT personas (e.g. `owner@uat.solvren.test`) and sample changes exist. If your DB is already seeded or you use a different flow, set `SKIP_E2E_SEED=1`.

3. **Server**: Playwright starts the app with `npm run build && npm run start` unless you set `PLAYWRIGHT_BASE_URL` to an existing URL.

## Commands

- `npm run test:e2e` — run e2e (globalSetup seeds, then tests)
- `npm run seed:e2e` — run seed then e2e (same effect if you don’t skip seed)
- `SKIP_E2E_SEED=1 npm run test:e2e` — skip automatic seed

See [docs/E2E_GATING_POLICY.md](../docs/E2E_GATING_POLICY.md) and [docs/UAT_SEED_DATA.md](../docs/UAT_SEED_DATA.md) for details.
