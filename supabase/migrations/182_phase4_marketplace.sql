-- Phase 4 — Integration marketplace metadata.
CREATE TABLE IF NOT EXISTS public.integration_marketplace_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  category text NOT NULL,
  logo_url text,
  is_official boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  capabilities_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  docs_url text,
  minimum_plan text NOT NULL DEFAULT 'starter',
  owner_type text NOT NULL DEFAULT 'solvren' CHECK (owner_type IN ('solvren', 'partner')),
  owner_name text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_marketplace_status ON public.integration_marketplace_entries(status);

ALTER TABLE public.integration_marketplace_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY integration_marketplace_select ON public.integration_marketplace_entries FOR SELECT
  USING (status = 'published');
CREATE POLICY integration_marketplace_service ON public.integration_marketplace_entries FOR ALL
  USING (auth.role() = 'service_role');
