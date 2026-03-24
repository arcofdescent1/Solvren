-- Phase 1 — Integration Mapping Layer (§7).
-- Templates (platform-owned) + org mappings + fields + runs.

-- integration_mapping_templates (platform defaults)
CREATE TABLE IF NOT EXISTS public.integration_mapping_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key text NOT NULL,
  source_object_type text NOT NULL,
  canonical_object_type text NOT NULL,
  name text NOT NULL DEFAULT '',
  version int NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_key, source_object_type, version)
);

CREATE INDEX IF NOT EXISTS idx_integration_mapping_templates_provider
  ON public.integration_mapping_templates(provider_key, source_object_type) WHERE is_active = true;

-- integration_mapping_template_fields
CREATE TABLE IF NOT EXISTS public.integration_mapping_template_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.integration_mapping_templates(id) ON DELETE CASCADE,
  source_path text NOT NULL,
  canonical_field text NOT NULL,
  transform_chain jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_mapping_template_fields_template
  ON public.integration_mapping_template_fields(template_id);

-- integration_mappings (org-specific)
CREATE TABLE IF NOT EXISTS public.integration_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider_key text NOT NULL,
  source_object_type text NOT NULL,
  canonical_object_type text NOT NULL,
  template_id uuid REFERENCES public.integration_mapping_templates(id) ON DELETE SET NULL,
  version int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, provider_key, source_object_type)
);

CREATE INDEX IF NOT EXISTS idx_integration_mappings_org
  ON public.integration_mappings(org_id);
CREATE INDEX IF NOT EXISTS idx_integration_mappings_active
  ON public.integration_mappings(org_id, provider_key) WHERE is_active = true;

-- integration_mapping_fields
CREATE TABLE IF NOT EXISTS public.integration_mapping_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mapping_id uuid NOT NULL REFERENCES public.integration_mappings(id) ON DELETE CASCADE,
  source_path text NOT NULL,
  canonical_field text NOT NULL,
  transform_chain jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_mapping_fields_mapping
  ON public.integration_mapping_fields(mapping_id);

-- integration_mapping_runs (test/audit)
CREATE TABLE IF NOT EXISTS public.integration_mapping_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mapping_id uuid NOT NULL REFERENCES public.integration_mappings(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  input_payload jsonb NOT NULL,
  output_payload jsonb,
  errors jsonb,
  status text NOT NULL CHECK (status IN ('success','warning','failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_mapping_runs_mapping
  ON public.integration_mapping_runs(mapping_id);
CREATE INDEX IF NOT EXISTS idx_integration_mapping_runs_created
  ON public.integration_mapping_runs(created_at DESC);

-- RLS
ALTER TABLE public.integration_mapping_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_mapping_template_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_mapping_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_mapping_runs ENABLE ROW LEVEL SECURITY;

-- Templates: read-only for org members
CREATE POLICY integration_mapping_templates_select ON public.integration_mapping_templates
  FOR SELECT USING (true);

CREATE POLICY integration_mapping_template_fields_select ON public.integration_mapping_template_fields
  FOR SELECT USING (true);

-- Mappings: org-scoped read/write for admins
CREATE POLICY integration_mappings_select ON public.integration_mappings
  FOR SELECT USING (public.is_org_member(org_id));

CREATE POLICY integration_mappings_insert ON public.integration_mappings
  FOR INSERT WITH CHECK (
    public.is_org_member(org_id) AND
    EXISTS (SELECT 1 FROM public.organization_members m WHERE m.org_id = integration_mappings.org_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin'))
  );

CREATE POLICY integration_mappings_update ON public.integration_mappings
  FOR UPDATE USING (
    public.is_org_member(org_id) AND
    EXISTS (SELECT 1 FROM public.organization_members m WHERE m.org_id = integration_mappings.org_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin'))
  );

CREATE POLICY integration_mapping_fields_select ON public.integration_mapping_fields
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.integration_mappings im WHERE im.id = integration_mapping_fields.mapping_id AND public.is_org_member(im.org_id))
  );

CREATE POLICY integration_mapping_fields_all ON public.integration_mapping_fields
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.integration_mappings im WHERE im.id = integration_mapping_fields.mapping_id AND public.is_org_member(im.org_id) AND
      EXISTS (SELECT 1 FROM public.organization_members m WHERE m.org_id = im.org_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin')))
  );

CREATE POLICY integration_mapping_runs_select ON public.integration_mapping_runs
  FOR SELECT USING (public.is_org_member(org_id));

CREATE POLICY integration_mapping_runs_insert ON public.integration_mapping_runs
  FOR INSERT WITH CHECK (
    public.is_org_member(org_id) AND
    EXISTS (SELECT 1 FROM public.organization_members m WHERE m.org_id = integration_mapping_runs.org_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin'))
  );

-- updated_at trigger for integration_mappings
DROP TRIGGER IF EXISTS trg_integration_mappings_updated_at ON public.integration_mappings;
CREATE TRIGGER trg_integration_mappings_updated_at BEFORE UPDATE ON public.integration_mappings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
