# Solvren Security — Phase 0 (Baseline Hardening)

Internal engineering reference: authentication, tenant isolation, authorization, privileged execution, and traceability for the Next.js App Router + Supabase stack.

## Security layers

1. **Identity** — Supabase Auth (`createServerSupabaseClient` + `getUser()`).
2. **Tenant isolation** — Postgres RLS using `public.is_org_member(org_id)` (and `is_org_admin` where stricter checks are needed).
3. **Authorization** — App RBAC: `src/lib/rbac/permissions.ts`, `canRole`, `hasPermissionInOrg`.
4. **Privileged boundary** — Service role only via `createPrivilegedClient(reason)` from `src/lib/server/adminClient.ts` (see `docs/service-role-inventory.md`).
5. **Traceability** — `audit_log` + `auditLog` / `auditLogStrict`; normalized actions in `src/lib/audit/actions.ts`.

## Canonical server API pattern

Use `src/lib/server/authz.ts` (finalized names):

| Step | Function |
|------|----------|
| Sign in | `requireUser()` (alias: `requireAuthenticatedUser`) |
| Verified email | `requireVerifiedUser()` → `SessionContext` |
| Membership only | `requireOrgMembership(orgId)` → `AuthzContext` |
| Membership + RBAC | `requireOrgPermission(orgId, permission)` → `AuthzContext` |
| Default org (legacy settings) | `resolveDefaultOrgForUser()` |
| Requested org UUID | `resolveRequestedOrg(orgId)` |
| Resource row → org | `resolveResourceInOrg({ table, resourceId, permission })` |

**`AuthzContext`:** `{ supabase, user: { id, email }, authState, orgId, role }`.

**HTTP contract:** `401` not signed in · `403` signed in but not allowed · `400` bad input · `404` resource not in scope.

**Rule:** Do not trust `orgId` from the client alone; always verify membership (and permission) using the SSR client before any privileged client.

## RLS

- Primary guarantee: a session using the **anon key + user JWT** cannot read/write rows outside org membership, even if an API route is wrong.
- Helpers: `public.is_org_member(uuid)` (existing), `public.is_org_admin(uuid)` (migration `175_phase0_security_hardening.sql`).
- Apply new org-scoped policies using these helpers; avoid recursive policy definitions on `organization_members` (see migration `102_org_members_select_no_recursion.sql`).

## Audit

- Prefer action names from `Phase0AuditAction` in `src/lib/audit/actions.ts`.
- `auditLog` — best-effort (warns on failure).
- `auditLogStrict` — use for membership/admin mutations; caller should **fail closed** if result is not `ok`.
- Metadata: never store secrets or raw tokens; `sanitizeAuditMetadata` strips common sensitive keys.

## Environment & production

- Server secrets only in server code; never `NEXT_PUBLIC_*` for service role.
- `validateRequiredEnv()` runs from `instrumentation.ts` (unless `SKIP_ENV_VALIDATION=1`).
- `validateProductionSecurityEnv()` runs when `NODE_ENV=production` **and** (`VERCEL_ENV=production` or `ENFORCE_PRODUCTION_SECRETS=1`) to reject placeholder Supabase URLs/keys and non-HTTPS `APP_URL` (non-localhost).

## Transport & headers

- `next.config.ts` sets baseline headers: **HSTS** (production), **X-Content-Type-Options**, **Referrer-Policy**, **X-Frame-Options**, **Permissions-Policy**, **CSP** (tuned for Next.js + Supabase `connect-src`).

## Tests

```bash
npm run test
npm run test:integration   # RUN_INTEGRATION_TESTS=1 + Supabase env — see docs/security/integration-tests.md
```

- **`requireAnyOrgPermission(permission)`** — first membership (by `created_at`) where the user has the given permission; for legacy “any org admin” operational routes.

Full RLS proofs: integration project + local Supabase + migrations. Playwright smoke tests remain in CI without real auth.

## Migrations

- **`175_phase0_security_hardening.sql`** — `is_org_admin(uuid)` + membership indexes.
- **`176_phase1_retention_and_lifecycle.sql`** — `data_retention_policies` + `change_events.deleted_at` (Phase 1 lifecycle).

Phase 0 spec referenced `063_*`; this repo already uses `063_seed_revenue_mitigations.sql`, so hardening is **175+**.

## Phase 1 pointers

- Data class: `docs/security/data-classification.md`
- Backup / restore: `docs/security/backup-recovery.md`, `docs/security/restore-test-checklist.md`
- Crypto / integration envelopes: `src/lib/server/crypto.ts`, `src/lib/server/integrations/secrets.ts`
- OAuth scope registry: `src/lib/integrations/scopeRegistry.ts`
- Soft delete helper: `src/lib/server/dataLifecycle.ts`
- Retention sweep: `runDataRetentionSweep` + `POST /api/cron/data-retention` (with `CRON_SECRET`); defaults + `data_retention_policies` resource types: `audit_log`, `notification_outbox`, `change_events_tombstone`.
- Integration token sealing + key rotation notes: `src/lib/server/integrationTokenFields.ts`, `docs/security/encryption-key-rotation.md`.

## Definition of done (Phase 0 checklist)

- [x] New protected routes use `authz` helpers (Phase 1: admin/** and integrations/** migrated).
- [ ] Service-role call sites documented with reasons (`docs/service-role-inventory.md`).
- [ ] Sensitive mutations emit audit events; membership flows use `auditLogStrict` where applicable.
- [ ] No secrets in logs or client bundles (periodic grep for `console.log` + env dumps).

## Out of scope (later phases)

SOC 2 policy packs, advanced secret rotation UX, backup/retention SLAs, full SIEM — not Phase 0.
