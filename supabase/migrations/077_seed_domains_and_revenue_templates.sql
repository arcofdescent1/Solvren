-- Phase 3.1 — Seed domains + baseline configs (SLA policies + approval requirements)

-- Domains
INSERT INTO public.domains (key, name, description, is_active)
VALUES
  ('REVENUE',  'Revenue',  'Revenue-impacting changes and safeguards', true),
  ('SECURITY', 'Security', 'Security-impacting changes and safeguards', true),
  ('DATA',     'Data',     'Data-impacting changes and safeguards', true),
  ('WORKFLOW', 'Workflow', 'Workflow-impacting changes and safeguards', true)
ON CONFLICT (key) DO UPDATE
  SET name = excluded.name,
      description = excluded.description,
      is_active = excluded.is_active;

-- Default SLA policies (per domain)
INSERT INTO public.domain_sla_policies (domain_key, policy_key, due_hours, due_soon_hours, escalation_hours)
VALUES
  ('REVENUE',  'DEFAULT',  48, 24, 72),
  ('REVENUE',  'CRITICAL', 24, 12, 48),
  ('SECURITY', 'DEFAULT',  48, 24, 72),
  ('SECURITY', 'CRITICAL', 24, 12, 48),
  ('DATA',     'DEFAULT',  72, 24, 96),
  ('WORKFLOW', 'DEFAULT',  96, 24, 120)
ON CONFLICT (domain_key, policy_key) DO UPDATE
  SET due_hours = excluded.due_hours,
      due_soon_hours = excluded.due_soon_hours,
      escalation_hours = excluded.escalation_hours;

-- Revenue approval requirements (example approval areas; match your UI)
INSERT INTO public.domain_approval_requirements (domain_key, approval_area, required_kinds, required_approvals, config)
VALUES
  ('REVENUE', 'FINANCE',  ARRAY['EXPOSURE'], 1, '{}'::jsonb),
  ('REVENUE', 'REVOPS',   ARRAY['ROLLBACK_PLAN', 'MONITORING'], 1, '{}'::jsonb)
ON CONFLICT (domain_key, approval_area) DO UPDATE
  SET required_kinds = excluded.required_kinds,
      required_approvals = excluded.required_approvals,
      config = excluded.config;
