-- Phase 3: Config-driven domains

CREATE TABLE IF NOT EXISTS public.domains (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.org_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  domain_key text NOT NULL REFERENCES public.domains(key) ON DELETE RESTRICT,
  enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, domain_key)
);

ALTER TABLE public.org_domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_domains_select ON public.org_domains;
CREATE POLICY org_domains_select ON public.org_domains
  FOR SELECT USING (is_org_member(org_id));

DROP POLICY IF EXISTS org_domains_write ON public.org_domains;
CREATE POLICY org_domains_write ON public.org_domains
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));
