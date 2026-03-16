-- Phase 3 — Domain-scoped signal + mitigation templates

CREATE TABLE IF NOT EXISTS public.domain_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_key text NOT NULL REFERENCES public.domains(key) ON DELETE CASCADE,
  signal_key text NOT NULL,
  name text NOT NULL,
  description text NULL,
  severity text NOT NULL DEFAULT 'MEDIUM',
  default_weight numeric NOT NULL DEFAULT 1.0,
  detector jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(domain_key, signal_key)
);

CREATE TABLE IF NOT EXISTS public.domain_signal_mitigations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_key text NOT NULL REFERENCES public.domains(key) ON DELETE CASCADE,
  signal_key text NOT NULL,
  mitigation_key text NOT NULL,
  recommendation text NOT NULL,
  severity text NOT NULL DEFAULT 'MEDIUM',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(domain_key, signal_key, mitigation_key)
);

CREATE TABLE IF NOT EXISTS public.org_signal_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  domain_key text NOT NULL REFERENCES public.domains(key) ON DELETE CASCADE,
  signal_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  weight_override numeric NULL,
  config_override jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, domain_key, signal_key)
);

ALTER TABLE public.org_signal_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_signal_overrides_select ON public.org_signal_overrides;
CREATE POLICY org_signal_overrides_select ON public.org_signal_overrides
  FOR SELECT USING (is_org_member(org_id));

DROP POLICY IF EXISTS org_signal_overrides_write ON public.org_signal_overrides;
CREATE POLICY org_signal_overrides_write ON public.org_signal_overrides
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));
