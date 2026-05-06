# Phase 1 — Operational checklist (non-code)

Complete before closing Phase 1 with stakeholders:

- [ ] All secrets rotated (Supabase, Vercel, integrations) per incident response
- [ ] Old secrets confirmed invalid in production and preview
- [ ] GitHub push protection enabled (org/repo settings)
- [ ] GitHub secret scanning enabled
- [ ] All shared archives that contained secrets deleted
- [ ] Handoffs use `npm run archive:safe` only (no manual zip of the repo root)

## Secret exposure protocol (Phase 1)

If secrets appear in Git history, archives, or other shared artifacts:

1. Rotate affected credentials immediately.
2. Identify exposure vector: local-only, shared archive, or committed to the repository.
3. If committed to the repo: evaluate `git filter-repo` or BFG history rewrite; notify stakeholders if external exposure is possible.
4. Delete all known copies of archives or artifacts that contained secrets.
5. Document the incident internally (timeline, scope, rotation IDs).

## CSP / headers — staging validation

Before merging changes to `next.config.ts` security headers or CSP:

- [ ] Login and session refresh (Supabase auth)
- [ ] Representative Supabase reads/writes from the app
- [ ] Sentry error reporting (throw a test error in staging)
- [ ] Critical integrations used in your staging org (OAuth redirects, webhooks as applicable)

Do **not** set `Cross-Origin-Resource-Policy: same-origin` without explicit product approval (OAuth/embed risk).

## JSON payload inventory

- CI generates `security-reports/json-payload-storage-inventory.json` and uploads it as a workflow artifact (not committed).
- Triage storage **surfaces** (table/column/route), not individual grep lines, in `json-payload-storage-triage.md`.

## Local development

If `npm run typecheck` errors on missing `.next/.../validator.ts` routes after a route was deleted, remove the stale `.next` directory and re-run typecheck.
