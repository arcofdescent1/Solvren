# Access control policy

**Applies to:** Solvren production systems, customer-facing product, and engineering tooling that can affect production.

**Owner:** Engineering Lead (Auth) / Operations Owner (platform access) — see [`../security-ownership.md`](../security-ownership.md).

**Related controls:** AC-01–AC-06 in [`../control-matrix.md`](../control-matrix.md).

---

## 1. Purpose

Ensure only authorized individuals access Solvren systems and data, with least privilege and clear removal when access is no longer needed.

---

## 2. Production and platform access

### 2.1 Who can access production

- **Application production** is operated via approved hosting (e.g., Vercel) and database (e.g., Supabase).
- **Production access** means: ability to change production configuration, secrets, deployments, database schema/data in production, or administrative product capabilities that affect all tenants.

### 2.2 How access is granted

- Access is granted **on need** for a defined role (e.g., deploy, DB admin, incident response).
- **Owner/manager approval** (or founder approval for small teams) before granting admin-level access to Vercel, Supabase production project, or GitHub org admin.
- Use **individual accounts** with MFA where the platform supports it; shared credentials are discouraged.

### 2.3 Least privilege

- Default to **read-only or scoped** roles where the vendor supports them.
- **Service role / database superuser** credentials are restricted to automated systems and a minimal set of people; stored only in approved secret stores (e.g., Vercel env), never in client code or public repos.

### 2.4 Removal

- Access is **revoked on role change or offboarding** within agreed timelines (target: same business day for critical roles where feasible).
- **Quarterly** (minimum **monthly** while scaling controls): verify roster against [`../access-review-process.md`](../access-review-process.md).

---

## 3. Product access (customer orgs)

### 3.1 Authentication

- Users authenticate via **Supabase Auth** (or successor documented in architecture).
- **Verified identity** is required for sensitive operations as implemented in application code.

### 3.2 Organization roles (RBAC)

- Permissions are **organization-scoped**: a user may only access data and actions for organizations where they are a member.
- **Role definitions** live in code (`permissions` / RBAC module); changes require code review per [`../secure-sdlc.md`](../secure-sdlc.md).

### 3.3 Tenant isolation

- **Database isolation** is enforced with **Row Level Security (RLS)** and membership helpers; application checks are defense in depth, not the sole control.
- See [`../../security-phase0.md`](../../security-phase0.md).

---

## 4. Privileged and service-role operations

### 4.1 Service role

- The Supabase **service role** bypasses RLS; it is used only from **trusted server contexts** with a **documented reason** (inventory maintained in-repo).
- New service-role call sites require **security-minded review** (see secure SDLC).

### 4.2 Internal admin routes

- Routes that trigger **jobs, retries, simulations, org-wide settings, or bulk operations** require **explicit permission checks** aligned with RBAC — not “logged in” alone.
- Admin capabilities are reviewed during **access reviews** and when adding new routes.

### 4.3 Auditability

- Security-relevant and privileged actions should emit **audit events** where feasible, without logging secrets (see data-handling and logging policies).

---

## 5. Exceptions

- **Emergency access** (e.g., break-glass Supabase access) is allowed only for **active incidents**, must be **time-bound**, and must be **documented** afterward in the incident record and next access review.

---

## 6. Review

This policy is reviewed **at least annually** or after a material access incident or org change.
