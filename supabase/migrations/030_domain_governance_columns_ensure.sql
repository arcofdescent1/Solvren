-- Ensure domain_governance_templates has required_approval_areas (text[]) and checklist_sections (jsonb).
-- Run once. Safe to re-run (IF NOT EXISTS / IF NOT EXISTS).

ALTER TABLE public.domain_governance_templates
  ADD COLUMN IF NOT EXISTS required_approval_areas text[] NULL,
  ADD COLUMN IF NOT EXISTS checklist_sections jsonb NULL;

CREATE INDEX IF NOT EXISTS idx_domain_gov_templates_lookup
  ON public.domain_governance_templates (domain, risk_bucket)
  WHERE enabled = true;
