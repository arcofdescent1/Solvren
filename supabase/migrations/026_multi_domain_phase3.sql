-- Phase 3 Item 1: Multi-domain risk architecture

-- 1.2 change_events gains domain
ALTER TABLE public.change_events
  ADD COLUMN IF NOT EXISTS domain text NOT NULL DEFAULT 'REVENUE';

ALTER TABLE public.change_events
  DROP CONSTRAINT IF EXISTS change_events_domain_check;

ALTER TABLE public.change_events
  ADD CONSTRAINT change_events_domain_check
  CHECK (domain IN ('REVENUE', 'DATA', 'WORKFLOW', 'SECURITY'));

-- 1.3 impact_assessments gains domain
ALTER TABLE public.impact_assessments
  ADD COLUMN IF NOT EXISTS domain text NOT NULL DEFAULT 'REVENUE';

ALTER TABLE public.impact_assessments
  DROP CONSTRAINT IF EXISTS impact_assessments_domain_check;

ALTER TABLE public.impact_assessments
  ADD CONSTRAINT impact_assessments_domain_check
  CHECK (domain IN ('REVENUE', 'DATA', 'WORKFLOW', 'SECURITY'));

-- 1.4 risk_signals: ensure domain is text with check (may be enum today)
ALTER TABLE public.risk_signals
  ALTER COLUMN domain TYPE text USING domain::text;

ALTER TABLE public.risk_signals
  DROP CONSTRAINT IF EXISTS risk_signals_domain_check;

ALTER TABLE public.risk_signals
  ADD CONSTRAINT risk_signals_domain_check
  CHECK (domain IN ('REVENUE', 'DATA', 'WORKFLOW', 'SECURITY'));

-- 1.5 approvals gains domain
ALTER TABLE public.approvals
  ADD COLUMN IF NOT EXISTS domain text NOT NULL DEFAULT 'REVENUE';

ALTER TABLE public.approvals
  DROP CONSTRAINT IF EXISTS approvals_domain_check;

ALTER TABLE public.approvals
  ADD CONSTRAINT approvals_domain_check
  CHECK (domain IN ('REVENUE', 'DATA', 'WORKFLOW', 'SECURITY'));

-- 1.6 change_signal_snapshot gains domain
ALTER TABLE public.change_signal_snapshot
  ADD COLUMN IF NOT EXISTS domain text NOT NULL DEFAULT 'REVENUE';

ALTER TABLE public.change_signal_snapshot
  DROP CONSTRAINT IF EXISTS change_signal_snapshot_domain_check;

ALTER TABLE public.change_signal_snapshot
  ADD CONSTRAINT change_signal_snapshot_domain_check
  CHECK (domain IN ('REVENUE', 'DATA', 'WORKFLOW', 'SECURITY'));

-- 2.1 domain_templates
CREATE TABLE IF NOT EXISTS public.domain_templates (
  domain text PRIMARY KEY,
  default_sla_hours int NOT NULL DEFAULT 72,
  default_risk_bucket text NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.domain_templates
  DROP CONSTRAINT IF EXISTS domain_templates_domain_check;

ALTER TABLE public.domain_templates
  ADD CONSTRAINT domain_templates_domain_check
  CHECK (domain IN ('REVENUE', 'DATA', 'WORKFLOW', 'SECURITY'));

-- 2.2 seed domain_templates
INSERT INTO public.domain_templates (domain, default_sla_hours)
VALUES
  ('REVENUE', 72),
  ('DATA', 96),
  ('WORKFLOW', 72),
  ('SECURITY', 48)
ON CONFLICT (domain) DO NOTHING;

-- 4.2 domain_scoring (optional multiplier)
CREATE TABLE IF NOT EXISTS public.domain_scoring (
  domain text PRIMARY KEY,
  base_multiplier numeric NOT NULL DEFAULT 1.0,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.domain_scoring
  DROP CONSTRAINT IF EXISTS domain_scoring_domain_check;

ALTER TABLE public.domain_scoring
  ADD CONSTRAINT domain_scoring_domain_check
  CHECK (domain IN ('REVENUE', 'DATA', 'WORKFLOW', 'SECURITY'));

INSERT INTO public.domain_scoring (domain, base_multiplier)
VALUES
  ('REVENUE', 1.0),
  ('DATA', 1.1),
  ('WORKFLOW', 1.0),
  ('SECURITY', 1.2)
ON CONFLICT (domain) DO NOTHING;
