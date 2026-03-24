# Access review checklist

**Purpose:** Structured checklist for monthly production and admin access review. Ensures no stale access and continued need.

**Owner:** Operations Owner  
**Cadence:** Monthly  
**Evidence:** `evidence/access-reviews/YYYY-MM.md`  
**Process:** [`access-review-process.md`](access-review-process.md)

---

## Systems to review

- [ ] **GitHub** — org/repo admin, branch protection, collaborators
- [ ] **Vercel** — deploy access, env vars access, project settings
- [ ] **Supabase** — project members, service role exposure, MFA
- [ ] **Sentry** — who can view production errors and PII-adjacent context
- [ ] **Secrets / env** — who can read production secrets in hosting UI
- [ ] **Resend / email** — admin access if applicable
- [ ] **Slack** — admin integrations if relevant
- [ ] **Solvren product** — admin routes, elevated internal roles

---

## Required steps

### 1. List all users with production access

For each system, document:

| System | User | Role/Access | Business need |
|--------|------|-------------|---------------|
| | | | |

### 2. List all users with admin tooling access

Anyone who can modify config, deploy, or access production data.

### 3. List all users with service-role capable access

- Supabase service key holders
- Break-glass accounts
- CI/CD that uses service role

### 4. Confirm continued need

For each person: **Still needed? Y/N**. If N, proceed to removal.

### 5. Remove stale access

Document: **What** | **When** | **By whom**

### 6. Confirm MFA where available

- GitHub: 2FA enabled for org members
- Vercel: MFA if supported
- Supabase: MFA for project members
- Document any gaps as remediation items

### 7. Product-specific: Solvren elevated capabilities

Review access to:

- [ ] Org settings management
- [ ] Integration secret handling
- [ ] Retry/dead-letter tools
- [ ] Policy management
- [ ] Simulation/admin tools
- [ ] Internal override flows

Confirm each capability is limited to intended roles per RBAC.

### 8. Document reviewer and date

**Reviewer:** [Name]  
**Date:** [YYYY-MM-DD]  
**Signoff:** Completed per process

---

## Evidence

Create or update `evidence/access-reviews/YYYY-MM.md` with:

- Systems reviewed (checklist)
- Users reviewed (name, role, still needed Y/N)
- Removals/changes (what, when, by whom)
- Reviewer signoff (name, date)
