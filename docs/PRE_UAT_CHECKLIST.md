# Pre-UAT Checklist

Complete these steps before running UAT or Playwright tests to avoid schema mismatches and timeouts.

## 1. Use Local Supabase

The remote Supabase project may have migration drift. For UAT, use local Supabase so the schema matches the repo.

```bash
# Start local Supabase (Docker required)
supabase start

# Apply all migrations
supabase db reset

# Get local credentials
supabase status
```

## 2. Point .env.local to Local Supabase

Copy the local URL and anon key from `supabase status` into `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<from supabase status>
```

## 3. Seed the UAT Dataset

```bash
npm run seed
```

If you see "Could not find table" or "column does not exist" errors, migrations are not fully applied. Re-run `supabase db reset`.

## 4. Run Tests Against Production Build

Playwright is configured to run against a production build (`npm run build && npm run start`). Do **not** use `npm run dev` for E2E—it is slower and can cause timeouts.

To run tests:

```bash
# Full flow (build + start + test)
npx playwright test

# Or if server is already running:
PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test
```

## 5. Skip Integration Tests (Optional)

If you don't have Jira/Slack staging configured:

```bash
npm run test:e2e:smoke
# or: SKIP_INTEGRATION_TESTS=1 npx playwright test
```

## Quick Sanity Check

1. `GET /api/health` → 200, `status: "healthy"`
2. `GET /` → 200 HTML (marketing page)
3. `GET /login` → 200 HTML (login form)
4. Login as `owner@uat.solvren.test` / `UAT-Pass5-Demo!` → redirect to dashboard
