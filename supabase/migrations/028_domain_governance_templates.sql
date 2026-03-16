-- Phase 3 Item 2: Domain-aware governance templates (evidence + approval areas per domain/bucket)

CREATE TABLE IF NOT EXISTS public.domain_governance_templates (
  domain text NOT NULL,
  risk_bucket text NOT NULL,
  required_evidence_kinds text[] NOT NULL DEFAULT '{}',
  required_approval_areas text[] NOT NULL DEFAULT '{}',
  checklist_sections text[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (domain, risk_bucket)
);

ALTER TABLE public.domain_governance_templates
  DROP CONSTRAINT IF EXISTS domain_governance_templates_domain_check;
ALTER TABLE public.domain_governance_templates
  ADD CONSTRAINT domain_governance_templates_domain_check
  CHECK (domain IN ('REVENUE', 'DATA', 'WORKFLOW', 'SECURITY'));

ALTER TABLE public.domain_governance_templates
  DROP CONSTRAINT IF EXISTS domain_governance_templates_bucket_check;
ALTER TABLE public.domain_governance_templates
  ADD CONSTRAINT domain_governance_templates_bucket_check
  CHECK (risk_bucket IN ('LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH', 'CRITICAL'));

INSERT INTO public.domain_governance_templates
(domain, risk_bucket, required_evidence_kinds, required_approval_areas, checklist_sections)
VALUES
-- REVENUE
('REVENUE', 'LOW',       '{}'::text[],                               array['RevOps', 'Engineering'],               '{}'::text[]),
('REVENUE', 'MEDIUM',    array['PR'],                                array['Finance', 'RevOps', 'Engineering'],     '{}'::text[]),
('REVENUE', 'HIGH',      array['PR', 'TEST_PLAN'],                    array['Finance', 'RevOps', 'Engineering'],     '{}'::text[]),
('REVENUE', 'VERY_HIGH', array['PR', 'TEST_PLAN', 'RUNBOOK', 'ROLLBACK'], array['Finance', 'RevOps', 'Engineering'],     array['Rollback readiness', 'Monitoring/validation']::text[]),
('REVENUE', 'CRITICAL',  array['PR', 'TEST_PLAN', 'RUNBOOK', 'ROLLBACK', 'DASHBOARD', 'COMMS_PLAN'], array['Finance', 'RevOps', 'Engineering', 'Support / CS'], array['Incident comms', 'Exec visibility']::text[]),
-- DATA
('DATA', 'LOW',       '{}'::text[],                         array['Data', 'Engineering'],                       '{}'::text[]),
('DATA', 'MEDIUM',    array['PR'],                          array['Data', 'Engineering'],                       '{}'::text[]),
('DATA', 'HIGH',      array['PR', 'TEST_PLAN'],             array['Data', 'Engineering'],                       array['Backfill plan']::text[]),
('DATA', 'VERY_HIGH', array['PR', 'TEST_PLAN', 'RUNBOOK', 'ROLLBACK'], array['Data', 'Engineering'],                array['Migration plan', 'Rollback readiness']::text[]),
('DATA', 'CRITICAL',  array['PR', 'TEST_PLAN', 'RUNBOOK', 'ROLLBACK', 'DASHBOARD', 'COMMS_PLAN'], array['Data', 'Engineering', 'Support / CS'], array['Customer impact', 'Recovery plan']::text[]),
-- WORKFLOW
('WORKFLOW', 'LOW',       '{}'::text[],                    array['RevOps', 'Engineering'],                      '{}'::text[]),
('WORKFLOW', 'MEDIUM',    array['PR'],                     array['RevOps', 'Engineering'],                      '{}'::text[]),
('WORKFLOW', 'HIGH',      array['PR', 'TEST_PLAN'],         array['RevOps', 'Engineering'],                      array['Runbook readiness']::text[]),
('WORKFLOW', 'VERY_HIGH', array['PR', 'TEST_PLAN', 'RUNBOOK', 'ROLLBACK'], array['RevOps', 'Engineering'],          array['Cutover plan', 'Rollback readiness']::text[]),
('WORKFLOW', 'CRITICAL',  array['PR', 'TEST_PLAN', 'RUNBOOK', 'ROLLBACK', 'DASHBOARD', 'COMMS_PLAN'], array['RevOps', 'Engineering', 'Support / CS'], array['Incident comms', 'Recovery plan']::text[]),
-- SECURITY
('SECURITY', 'LOW',       '{}'::text[],                    array['Security', 'Engineering'],                    '{}'::text[]),
('SECURITY', 'MEDIUM',    array['PR'],                     array['Security', 'Engineering'],                    array['Threat model (light)']::text[]),
('SECURITY', 'HIGH',      array['PR', 'TEST_PLAN'],         array['Security', 'Engineering'],                    array['Threat model', 'Access review']::text[]),
('SECURITY', 'VERY_HIGH', array['PR', 'TEST_PLAN', 'RUNBOOK', 'ROLLBACK'], array['Security', 'Engineering'],        array['Threat model', 'Rollback readiness']::text[]),
('SECURITY', 'CRITICAL',  array['PR', 'TEST_PLAN', 'RUNBOOK', 'ROLLBACK', 'DASHBOARD', 'COMMS_PLAN'], array['Security', 'Engineering', 'Support / CS'], array['Security comms', 'Executive awareness']::text[])
ON CONFLICT (domain, risk_bucket) DO NOTHING;
