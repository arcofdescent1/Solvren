-- Phase 3 — Default approval requirements for SECURITY, DATA, WORKFLOW

-- SECURITY approval requirements
INSERT INTO public.domain_approval_requirements (
  domain_key, approval_area, required_kinds, required_approvals, config
)
VALUES
  ('SECURITY', 'SECURITY', ARRAY['THREAT_MODEL', 'ROLLBACK_PLAN', 'MONITORING'], 1, '{}'::jsonb),
  ('SECURITY', 'ENGINEERING', ARRAY['TESTS'], 1, '{}'::jsonb)
ON CONFLICT (domain_key, approval_area) DO UPDATE
  SET required_kinds = excluded.required_kinds,
      required_approvals = excluded.required_approvals,
      config = excluded.config;

-- DATA approval requirements
INSERT INTO public.domain_approval_requirements (
  domain_key, approval_area, required_kinds, required_approvals, config
)
VALUES
  ('DATA', 'DATA', ARRAY['MIGRATION_PLAN', 'BACKFILL_PLAN', 'ROLLBACK_PLAN'], 1, '{}'::jsonb),
  ('DATA', 'ENGINEERING', ARRAY['TESTS', 'MONITORING'], 1, '{}'::jsonb)
ON CONFLICT (domain_key, approval_area) DO UPDATE
  SET required_kinds = excluded.required_kinds,
      required_approvals = excluded.required_approvals,
      config = excluded.config;

-- WORKFLOW approval requirements
INSERT INTO public.domain_approval_requirements (
  domain_key, approval_area, required_kinds, required_approvals, config
)
VALUES
  ('WORKFLOW', 'REVOPS', ARRAY['MONITORING', 'ROLLBACK_PLAN'], 1, '{}'::jsonb),
  ('WORKFLOW', 'ENGINEERING', ARRAY['TESTS'], 1, '{}'::jsonb)
ON CONFLICT (domain_key, approval_area) DO UPDATE
  SET required_kinds = excluded.required_kinds,
      required_approvals = excluded.required_approvals,
      config = excluded.config;
