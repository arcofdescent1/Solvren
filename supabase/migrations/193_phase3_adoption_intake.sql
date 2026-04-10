-- Phase 3 — Adoption mode, intake provenance, imports, custom sources, OPERATIONS domain

-- Extend domain enum for operational intake (aligned with IntakeRecordType mapping)
ALTER TABLE public.change_events
  DROP CONSTRAINT IF EXISTS change_events_domain_check;
ALTER TABLE public.change_events
  ADD CONSTRAINT change_events_domain_check
  CHECK (domain IN ('REVENUE', 'DATA', 'WORKFLOW', 'SECURITY', 'OPERATIONS'));

ALTER TABLE public.impact_assessments
  DROP CONSTRAINT IF EXISTS impact_assessments_domain_check;
ALTER TABLE public.impact_assessments
  ADD CONSTRAINT impact_assessments_domain_check
  CHECK (domain IN ('REVENUE', 'DATA', 'WORKFLOW', 'SECURITY', 'OPERATIONS'));

ALTER TABLE public.risk_signals
  DROP CONSTRAINT IF EXISTS risk_signals_domain_check;
ALTER TABLE public.risk_signals
  ADD CONSTRAINT risk_signals_domain_check
  CHECK (domain IN ('REVENUE', 'DATA', 'WORKFLOW', 'SECURITY', 'OPERATIONS'));

ALTER TABLE public.approvals
  DROP CONSTRAINT IF EXISTS approvals_domain_check;
ALTER TABLE public.approvals
  ADD CONSTRAINT approvals_domain_check
  CHECK (domain IN ('REVENUE', 'DATA', 'WORKFLOW', 'SECURITY', 'OPERATIONS'));

ALTER TABLE public.change_signal_snapshot
  DROP CONSTRAINT IF EXISTS change_signal_snapshot_domain_check;
ALTER TABLE public.change_signal_snapshot
  ADD CONSTRAINT change_signal_snapshot_domain_check
  CHECK (domain IN ('REVENUE', 'DATA', 'WORKFLOW', 'SECURITY', 'OPERATIONS'));

ALTER TABLE public.domain_templates
  DROP CONSTRAINT IF EXISTS domain_templates_domain_check;
ALTER TABLE public.domain_templates
  ADD CONSTRAINT domain_templates_domain_check
  CHECK (domain IN ('REVENUE', 'DATA', 'WORKFLOW', 'SECURITY', 'OPERATIONS'));

INSERT INTO public.domain_templates (domain, default_sla_hours)
VALUES ('OPERATIONS', 72)
ON CONFLICT (domain) DO NOTHING;

ALTER TABLE public.domain_scoring
  DROP CONSTRAINT IF EXISTS domain_scoring_domain_check;
ALTER TABLE public.domain_scoring
  ADD CONSTRAINT domain_scoring_domain_check
  CHECK (domain IN ('REVENUE', 'DATA', 'WORKFLOW', 'SECURITY', 'OPERATIONS'));

INSERT INTO public.domain_scoring (domain, base_multiplier)
VALUES ('OPERATIONS', 1.0)
ON CONFLICT (domain) DO NOTHING;

-- change_events: intake provenance (indexed)
ALTER TABLE public.change_events
  ADD COLUMN IF NOT EXISTS source_mode text NULL
    CHECK (source_mode IS NULL OR source_mode IN ('MANUAL', 'SPREADSHEET', 'CUSTOM', 'NATIVE', 'UNKNOWN')),
  ADD COLUMN IF NOT EXISTS intake_record_type text NULL,
  ADD COLUMN IF NOT EXISTS source_label text NULL,
  ADD COLUMN IF NOT EXISTS source_reference text NULL,
  ADD COLUMN IF NOT EXISTS intake_metadata_json jsonb NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_change_events_org_source_mode
  ON public.change_events (org_id, source_mode)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_change_events_org_intake_record_type
  ON public.change_events (org_id, intake_record_type)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_change_events_org_created
  ON public.change_events (org_id, created_at DESC)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.change_events.source_mode IS 'Phase 3: MANUAL, SPREADSHEET, CUSTOM, NATIVE, UNKNOWN';
COMMENT ON COLUMN public.change_events.intake_record_type IS 'Phase 3: IntakeRecordType string';

-- Org adoption mode
ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS adoption_mode text NULL
    CHECK (adoption_mode IS NULL OR adoption_mode IN ('NATIVE_FIRST', 'MANUAL_FIRST', 'HYBRID'))
  DEFAULT 'HYBRID';

COMMENT ON COLUMN public.organization_settings.adoption_mode IS 'Phase 3: first-run navigation default';

-- import_batches
CREATE TABLE IF NOT EXISTS public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  integration_file_upload_id uuid NULL REFERENCES public.integration_file_uploads (id) ON DELETE SET NULL,
  source_type text NOT NULL CHECK (source_type IN ('CSV', 'XLSX')),
  workflow_mode text NOT NULL DEFAULT 'DRAFT' CHECK (workflow_mode IN ('DRAFT', 'ACTIVE')),
  status text NOT NULL DEFAULT 'PREVIEW'
    CHECK (status IN ('PREVIEW', 'PROCESSING', 'QUEUED', 'COMPLETE', 'COMPLETE_WITH_WARNINGS', 'FAILED')),
  file_name text NOT NULL,
  total_rows int NOT NULL DEFAULT 0,
  imported_rows int NOT NULL DEFAULT 0,
  failed_rows int NOT NULL DEFAULT 0,
  warning_count int NOT NULL DEFAULT 0,
  mapping_snapshot_json jsonb NULL,
  warning_summary_json jsonb NULL,
  failed_row_details_json jsonb NULL,
  preview_expires_at timestamptz NULL,
  progress_json jsonb NULL,
  batch_name text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_import_batches_org_created
  ON public.import_batches (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_batches_org_user
  ON public.import_batches (org_id, created_by_user_id);

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY import_batches_select ON public.import_batches
  FOR SELECT USING (public.is_org_member (org_id));
CREATE POLICY import_batches_insert ON public.import_batches
  FOR INSERT WITH CHECK (public.is_org_member (org_id));
CREATE POLICY import_batches_update ON public.import_batches
  FOR UPDATE USING (
    public.is_org_member (org_id)
    AND (
      created_by_user_id = auth.uid ()
      OR public.is_org_admin (org_id)
    )
  );
CREATE POLICY import_batches_service ON public.import_batches
  FOR ALL USING (auth.role () = 'service_role');

COMMENT ON TABLE public.import_batches IS 'Phase 3: spreadsheet import preview/commit tracking';

-- custom_sources
CREATE TABLE IF NOT EXISTS public.custom_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  input_method text NOT NULL CHECK (input_method IN ('JSON_WEBHOOK', 'CSV_TEMPLATE', 'MANUAL_UPLOAD')),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ERROR')),
  webhook_path_key text NOT NULL UNIQUE,
  webhook_secret_ciphertext text NOT NULL,
  webhook_secret_previous_ciphertext text NULL,
  mapping_config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  sample_payload_json jsonb NULL,
  default_intake_record_type text NULL,
  rate_limit_per_minute int NOT NULL DEFAULT 60,
  ip_allowlist_cidr text[] NULL,
  created_by_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_sources_org ON public.custom_sources (org_id);
CREATE INDEX IF NOT EXISTS idx_custom_sources_webhook_key ON public.custom_sources (webhook_path_key);

ALTER TABLE public.custom_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY custom_sources_select ON public.custom_sources
  FOR SELECT USING (public.is_org_admin (org_id));
CREATE POLICY custom_sources_insert ON public.custom_sources
  FOR INSERT WITH CHECK (public.is_org_admin (org_id));
CREATE POLICY custom_sources_update ON public.custom_sources
  FOR UPDATE USING (public.is_org_admin (org_id));
CREATE POLICY custom_sources_delete ON public.custom_sources
  FOR DELETE USING (public.is_org_admin (org_id));
CREATE POLICY custom_sources_service ON public.custom_sources
  FOR ALL USING (auth.role () = 'service_role');

COMMENT ON TABLE public.custom_sources IS 'Phase 3: org-scoped custom ingestion (webhook key separate from id)';

CREATE TABLE IF NOT EXISTS public.custom_source_external_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_source_id uuid NOT NULL REFERENCES public.custom_sources (id) ON DELETE CASCADE,
  external_record_id text NOT NULL,
  change_event_id uuid NOT NULL REFERENCES public.change_events (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (custom_source_id, external_record_id)
);

CREATE INDEX IF NOT EXISTS idx_custom_source_ext_change ON public.custom_source_external_records (change_event_id);

ALTER TABLE public.custom_source_external_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY custom_source_ext_service ON public.custom_source_external_records
  FOR ALL USING (auth.role () = 'service_role');
CREATE POLICY custom_source_ext_admin_select ON public.custom_source_external_records
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.custom_sources s
      WHERE s.id = custom_source_external_records.custom_source_id
        AND public.is_org_admin (s.org_id)
    )
  );

-- Backfill source_mode on legacy change_events
UPDATE public.change_events
SET source_mode = 'NATIVE'
WHERE source_mode IS NULL
  AND (
    (intake::text ILIKE '%"github"%')
    OR (intake::text ILIKE '%"jira"%')
    OR (intake::text ILIKE '%slack%')
  );

UPDATE public.change_events
SET source_mode = 'UNKNOWN'
WHERE source_mode IS NULL;

-- Register OPERATIONS domain and enable for existing orgs
INSERT INTO public.domains (key, name, description)
VALUES ('OPERATIONS', 'Operations', 'Operational risk and operating cadence')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.org_domains (org_id, domain_key, enabled)
SELECT o.id, 'OPERATIONS', true
FROM public.organizations o
ON CONFLICT (org_id, domain_key) DO UPDATE SET enabled = EXCLUDED.enabled;
