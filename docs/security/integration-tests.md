# Supabase RLS / authz integration tests

## Running

```bash
# Local: start Supabase with migrations applied, then:
set RUN_INTEGRATION_TESTS=1
set NEXT_PUBLIC_SUPABASE_URL=...
set NEXT_PUBLIC_SUPABASE_ANON_KEY=...
set SUPABASE_SERVICE_ROLE_KEY=...
npm run test:integration
```

(`cross-env` is used on Windows in `npm run test:integration`.)

## What is covered

- **`src/lib/server/changeEvents.rls.integration.test.ts`** — creates two orgs and two users via the service-role client; inserts a `change_events` row in org B; signs in as user A (org A only) and asserts `select` on that change id returns **no row** (RLS + soft-delete policies must be applied).

## CI

- Default **`npm run test`** runs **unit** project only (`--project unit`).
- Wire `test:integration` in CI only when secrets and a disposable database are available.

## Extending

- Add cases for `issues`, `approval_mappings`, etc., using the same pattern: service role for setup/teardown, anon client + `signInWithPassword` for actor sessions.
