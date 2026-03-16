-- 050 — Unique on (org_id, domain, risk_bucket, required_role) for idempotent bootstrap upsert (Patch 1A.4)

create unique index if not exists idx_approval_requirements_org_domain_bucket_role
  on public.approval_requirements(org_id, domain, risk_bucket, required_role);
