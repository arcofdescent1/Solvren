# Security FAQ — Objection Handling

**For:** Sales, customer success — answer 80% of security questions without engineering

---

## "How do you isolate data?"

**Short:** PostgreSQL Row Level Security (RLS) plus application checks. Users cannot access rows outside organizations they belong to.

**Detail:** Every query is filtered by `is_org_member(org_id)`. The database enforces this even if application code has a bug. We also verify membership and permission in API routes before any data access.

---

## "Do you encrypt data?"

**Short:** Yes. TLS in transit; encryption at rest (Supabase); application-layer encryption for integration tokens.

**Detail:** All traffic uses HTTPS. The database is encrypted at rest via Supabase. OAuth tokens and API keys are encrypted before storage using a server-side key. We support key rotation for integration credentials.

---

## "How do integrations work securely?"

**Short:** OAuth-based; tokens encrypted at rest; org-scoped; health-tracked.

**Detail:** Integrations use OAuth. We store only what we need; tokens are encrypted. Every integration is tied to an org. We track health (last success, failure rate) and have retry/dead-letter handling with admin visibility.

---

## "Do you support SSO?"

**Short:** Yes. SAML 2.0 and OIDC. Org-level configuration; role mapping from IdP groups.

**Detail:** Admins configure SSO per organization. We support Okta, Azure AD, and other standard IdP. Role mapping lets you map external groups to Solvren roles. JIT provisioning can be enabled or disabled.

---

## "Where is our data stored?"

**Short:** Supabase (PostgreSQL); primarily US. Region can be configured.

**Detail:** Default is US. Supabase supports region selection. Subprocessors and locations are documented. Contact us for data residency requirements.

---

## "Who has access to our data?"

**Short:** Only your org members with appropriate roles. Solvren staff do not routinely access customer data.

**Detail:** Access is org-scoped and role-based. We use least privilege for internal tooling. Support access (if ever needed) would be with consent and audit. Production access is reviewed monthly.

---

## "What about backups and restore?"

**Short:** Automated backups; restore tested quarterly; evidence retained.

**Detail:** Supabase provides backups per plan. We run a full restore drill quarterly and document the outcome. Retention policies are configurable.

---

## "Have you had a penetration test?"

**Short:** Yes. Annual third-party penetration test; high/critical findings remediated before enterprise rollout.

**Detail:** Scope includes auth, RLS, APIs, admin routes, integrations, token handling, Next.js/Supabase. We can share an executive summary under NDA.

---

## "Are you SOC 2 certified?"

**Short:** We operate a SOC-aligned control environment and can pursue certification when required.

**Detail:** We have documented controls, policies, evidence, and operating cadences consistent with SOC readiness. Formal SOC 2 Type I/II can be pursued as needed. We can provide a roadmap under NDA.

---

## "Who are your subprocessors?"

**Short:** Vercel, Supabase, GitHub (core). Optional: Sentry, Resend, Slack, Stripe, OpenAI. Integration providers when you enable them.

**Detail:** Full list is in our subprocessor document. We update it when material changes occur and support contractual notice requirements.

---

## "How do you handle incidents?"

**Short:** Defined severity model, assigned roles, documented process. Customers notified when there is material service or data impact.

**Detail:** We classify incidents SEV-1–4. Critical incidents trigger immediate escalation and customer communication planning. Postmortems are required for SEV-1/2. Process is documented in our incident runbook.

---

**Escalate when:** Custom attestations, on-prem, customer-managed keys, detailed legal/DPA questions.
