# Release Cleanliness Checklist

Use this before any archive, beta handoff, or UAT package so Pass 1 stays done.

---

## Pre-release checks

- [ ] `git status` is clean — no unintended changes or junk in working tree
- [ ] No ` .env.local` in the repo or in any archive
- [ ] No generated report folders (`playwright-report/`, `test-results/`) in the package
- [ ] No local build artifacts (`.next/`, `tsconfig.tsbuildinfo`) in the package
- [ ] No generic Next.js README — root `README.md` is product-specific
- [ ] No untracked junk in repo root (zip files, local dumps, temp exports)
- [ ] `.env.example` is current and reflects all required/optional vars
- [ ] Docs links are valid — `docs/DEPLOYMENT.md`, `docs/PRODUCTION_READINESS.md` exist and match reality

---

## Lightweight command checks

```bash
# 1. Repo is clean
git status

# 2. No forbidden files (should return nothing)
git ls-files | grep -E '\.env\.local|playwright-report|test-results|\.next/|tsconfig\.tsbuildinfo'

# 3. .env.example is tracked
git ls-files .env.example
```

---

## Archive/export hygiene

When creating zip exports for audits, demos, or handoff:

- Exclude `.env.local` and all `.env*` except `.env.example`
- Exclude `playwright-report/`, `test-results/`, `.next/`
- Exclude `node_modules/` unless intentionally required
- Exclude temp artifacts, local caches, `*.zip` files

---

## If a secret was ever committed

1. Remove the secret from history or rotate it in the provider (Supabase, Stripe, Slack, etc.).
2. Update the deployment environment with the new value.
3. Re-verify no live secrets remain in source.
