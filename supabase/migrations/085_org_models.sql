-- Optional ML layer — org model coefficients store
-- Phase 4 Pass 2B: logistic regression trainer + model store

CREATE TABLE IF NOT EXISTS public.org_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  domain text NOT NULL,
  model_key text NOT NULL, -- e.g. LOGREG_V1
  coefficients jsonb NOT NULL DEFAULT '{}'::jsonb, -- { intercept, weights: { [feature]: number }, features: string[] }
  trained_at timestamptz NOT NULL DEFAULT now(),
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb -- { sample_size, pos_rate, loss, aucApprox?, brier? }
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_org_models
  ON public.org_models(org_id, domain, model_key);

CREATE INDEX IF NOT EXISTS idx_org_models_org_domain
  ON public.org_models(org_id, domain);

ALTER TABLE public.org_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_models_select ON public.org_models;
CREATE POLICY org_models_select ON public.org_models
  FOR SELECT USING (is_org_member(org_id));

DROP POLICY IF EXISTS org_models_write_server ON public.org_models;
CREATE POLICY org_models_write_server ON public.org_models
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
