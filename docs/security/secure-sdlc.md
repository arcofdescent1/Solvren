# Secure SDLC baseline

**Purpose:** Embed **security expectations** into everyday engineering — reviews, dependencies, migrations, and releases.

**Owner:** Engineering Lead  
**Policies:** [`policies/change-management-policy.md`](policies/change-management-policy.md), [`policies/data-handling-policy.md`](policies/data-handling-policy.md)

---

## 1. Code review

- **All production code** merges via PR with approval per change-management policy.
- Reviewers check for **secrets in diff**, **auth bypass**, and **logging of sensitive data**.

---

## 2. Secret scanning

- Enable **GitHub secret scanning** and push protection when available on the org/plan.
- **Manual rule:** No API keys, tokens, or `service_role` strings in commits; use env and secret manager.
- **Pre-merge (author checklist):** Search PR for `password`, `secret`, `token`, `BEGIN`, `service_role` in unintended contexts.

---

## 3. Dependency hygiene

- **Monthly:** Review critical Dependabot / npm audit items; triage or schedule upgrades.
- **Document** decisions for deferred critical issues (risk acceptance note in ticket or release notes).
- Pin major versions consciously; test after upgrades touching **auth**, **crypto**, or **database clients**.

---

## 4. Migration review

For every DB migration, reviewers confirm:

- [ ] **RLS** still prevents cross-tenant access (new tables get policies).  
- [ ] **Data exposure** — no overly broad `SELECT` grants or policies.  
- [ ] **Rollback** — down migration or forward-fix documented.  
- [ ] **Performance** — indexes for large backfills if needed.

---

## 5. Security-sensitive change checklist

**Any PR touching the following requires explicit security-minded review** (tag reviewer or security champion):

- Authentication / sessions / cookies  
- Org **membership** or **roles**  
- **RLS** migrations or `SECURITY DEFINER` functions  
- **Service-role** usage or new privileged clients  
- **Integration credentials** (OAuth, API keys, encryption)  
- **Admin** or **cron** routes  
- **Audit logging** schema or sensitive metadata paths  

---

## 6. PR checklist (author)

Copy into PR description for significant changes:

- [ ] No secrets or tokens in code or tests  
- [ ] Authz path uses `requireVerifiedUser` / `requireOrgPermission` / `resolveResourceInOrg` as appropriate  
- [ ] No logging of credentials or PII beyond policy  
- [ ] Migrations reviewed for RLS  
- [ ] Audit event added if user-visible security/admin action  

---

## 7. Release checklist (releaser)

- [ ] Release logged in [`evidence/releases/release-log.md`](evidence/releases/release-log.md)  
- [ ] Migrations listed and applied in correct order  
- [ ] Rollback or forward-fix noted for risky changes  
- [ ] Smoke test critical paths post-deploy  

---

## 8. Emergency fix checklist

- [ ] Incident severity assigned  
- [ ] Smallest safe change deployed  
- [ ] Leadership aware for SEV-1/2  
- [ ] Backfill PR + release log within 48h  
- [ ] Postmortem scheduled if SEV-1/2  

---

## 9. References

- [`../security-phase0.md`](../security-phase0.md) — canonical API authz pattern  
- [`integration-tests.md`](integration-tests.md) — RLS integration tests  
- [`control-matrix.md`](control-matrix.md) — control mapping
