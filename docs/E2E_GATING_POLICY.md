# E2E Gating Policy

Pass 6 — Beta/UAT readiness requires the E2E suite to pass.

## Tiers

### Tier 1 — Required for beta/UAT

Runs on every CI pipeline. Must pass before:

- UAT handoff
- Beta deployment signoff
- Release candidate promotion

**Scope:**

- auth.spec.ts — Auth and protected routes
- api-auth.spec.ts — API auth blocks
- change-intake.spec.ts — Submitter workflow
- approval-flow.spec.ts — Reviewer workflow
- rbac.spec.ts — Role-based access
- restricted-visibility.spec.ts — Restricted change visibility
- dashboard-search.spec.ts — Dashboard and search
- workflows.spec.ts — Smoke (health, admin auth)
- notifications.spec.ts — Notifications page

### Tier 2 — Extended (optional)

- golden.spec.ts — Visual snapshots (opt-in: `PLAYWRIGHT_VISUAL=1`)

## Prerequisites

1. **Supabase**: All migrations applied. In `.env.local` set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
2. **Seeded UAT data**: Playwright **globalSetup** runs `npm run seed` before tests, so UAT personas and sample changes exist. Workflow tests (change-intake, approval-flow, restricted-visibility, dashboard-search) depend on this. To skip the automatic seed (e.g. you already seeded or use a different DB), set `SKIP_E2E_SEED=1`.
3. **App**: Started automatically by Playwright (`npm run build && npm run start`) unless `PLAYWRIGHT_BASE_URL` is set (e.g. to use an existing server).

## Commands

```bash
# Tier 1 (default) — globalSetup seeds DB, then runs tests
npm run test:e2e

# Skip automatic seed (use existing DB state)
SKIP_E2E_SEED=1 npm run test:e2e

# Tier 2 visual (opt-in)
PLAYWRIGHT_VISUAL=1 npm run test:e2e

# Explicit seed then test (same as default, but seed runs manually)
npm run seed:e2e
```

## Failure Policy

If a Tier 1 E2E test fails:

1. Build is **not** beta-ready.
2. Failure must be triaged as:
   - Product regression
   - Fixture drift (seed data out of sync)
   - Environment issue
3. Green status cannot be manually overridden.

## Test Naming

Tests are named to answer:

- **What** failed (workflow/scenario)
- **Which** persona (role) failed
- **Why** (environment vs product)

Example: `reviewer sees My Approvals queue with seeded changes` — persona: reviewer, workflow: My Approvals, expectation: seeded data.
