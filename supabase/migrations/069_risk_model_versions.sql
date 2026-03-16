CREATE TABLE IF NOT EXISTS public.risk_model_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  domain text NOT NULL DEFAULT 'REVENUE',
  model_version integer NOT NULL,
  frozen_at timestamptz NOT NULL DEFAULT now(),
  frozen_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  note text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_risk_model_versions_org_domain_version
  ON public.risk_model_versions(org_id, domain, model_version);

ALTER TABLE public.risk_model_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS risk_model_versions_select ON public.risk_model_versions;
CREATE POLICY risk_model_versions_select ON public.risk_model_versions
  FOR SELECT USING (is_org_member(org_id));

DROP POLICY IF EXISTS risk_model_versions_insert_admin ON public.risk_model_versions;
CREATE POLICY risk_model_versions_insert_admin ON public.risk_model_versions
  FOR INSERT WITH CHECK (
    is_org_member(org_id) AND
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.org_id = risk_model_versions.org_id
        AND m.user_id = auth.uid()
        AND m.role = 'admin'
    )
  );

DROP POLICY IF EXISTS risk_model_versions_write_server ON public.risk_model_versions;
CREATE POLICY risk_model_versions_write_server ON public.risk_model_versions
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
