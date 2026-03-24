# Restore test checklist (monthly)

- [ ] Identify latest production backup / PITR snapshot available in Supabase.
- [ ] Restore into **non-production** project or database branch.
- [ ] Apply migrations (`supabase db push` / CI migration pipeline) if restore is raw.
- [ ] Set `APP_URL`, Supabase URL/keys to restored environment.
- [ ] Run `npm run typecheck` and unit tests.
- [ ] Smoke: login (if auth linked), open dashboard, list changes for a known org.
- [ ] Record date, engineer, pass/fail, anomalies in team runbook.

**Failure:** open incident; do not assume backups are valid until this passes.
