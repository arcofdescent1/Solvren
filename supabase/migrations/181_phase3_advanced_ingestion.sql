-- Phase 3 — Advanced Ingestion: source configs, schedules, checkpoints, replay, file uploads.

-- Storage bucket for CSV uploads (optional; run manually if storage not yet initialized)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('integration-uploads', 'integration-uploads', false) ON CONFLICT (id) DO NOTHING;

-- 8.1 integration_source_configs — Per-install source configuration
CREATE TABLE IF NOT EXISTS public.integration_source_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider_key text NOT NULL,
  integration_account_id uuid REFERENCES public.integration_accounts(id) ON DELETE CASCADE,
  config_json jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'error')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_source_configs_org
  ON public.integration_source_configs(org_id);
CREATE INDEX IF NOT EXISTS idx_integration_source_configs_account
  ON public.integration_source_configs(integration_account_id);

ALTER TABLE public.integration_source_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY integration_source_configs_select ON public.integration_source_configs FOR SELECT
  USING (public.is_org_member(org_id));
CREATE POLICY integration_source_configs_insert ON public.integration_source_configs FOR INSERT
  WITH CHECK (public.is_org_member(org_id));
CREATE POLICY integration_source_configs_update ON public.integration_source_configs FOR UPDATE
  USING (public.is_org_member(org_id));
CREATE POLICY integration_source_configs_delete ON public.integration_source_configs FOR DELETE
  USING (public.is_org_member(org_id));
CREATE POLICY integration_source_configs_service ON public.integration_source_configs FOR ALL
  USING (auth.role() = 'service_role');

-- 8.2 integration_sync_schedules — Recurring schedules
CREATE TABLE IF NOT EXISTS public.integration_sync_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_account_id uuid NOT NULL REFERENCES public.integration_accounts(id) ON DELETE CASCADE,
  job_type text NOT NULL,
  cron_expression text NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  last_result jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_sync_schedules_next
  ON public.integration_sync_schedules(next_run_at) WHERE enabled = true;

ALTER TABLE public.integration_sync_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY integration_sync_schedules_select ON public.integration_sync_schedules FOR SELECT
  USING (public.is_org_member(org_id));
CREATE POLICY integration_sync_schedules_insert ON public.integration_sync_schedules FOR INSERT
  WITH CHECK (public.is_org_member(org_id));
CREATE POLICY integration_sync_schedules_update ON public.integration_sync_schedules FOR UPDATE
  USING (public.is_org_member(org_id));
CREATE POLICY integration_sync_schedules_delete ON public.integration_sync_schedules FOR DELETE
  USING (public.is_org_member(org_id));
CREATE POLICY integration_sync_schedules_service ON public.integration_sync_schedules FOR ALL
  USING (auth.role() = 'service_role');

-- 8.3 integration_sync_checkpoints — Incremental cursors
CREATE TABLE IF NOT EXISTS public.integration_sync_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_account_id uuid NOT NULL REFERENCES public.integration_accounts(id) ON DELETE CASCADE,
  source_object_type text NOT NULL,
  checkpoint_json jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(integration_account_id, source_object_type)
);

CREATE INDEX IF NOT EXISTS idx_integration_sync_checkpoints_account
  ON public.integration_sync_checkpoints(integration_account_id);

ALTER TABLE public.integration_sync_checkpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY integration_sync_checkpoints_select ON public.integration_sync_checkpoints FOR SELECT
  USING (public.is_org_member(org_id));
CREATE POLICY integration_sync_checkpoints_insert ON public.integration_sync_checkpoints FOR INSERT
  WITH CHECK (public.is_org_member(org_id));
CREATE POLICY integration_sync_checkpoints_update ON public.integration_sync_checkpoints FOR UPDATE
  USING (public.is_org_member(org_id));
CREATE POLICY integration_sync_checkpoints_service ON public.integration_sync_checkpoints FOR ALL
  USING (auth.role() = 'service_role');

-- 8.4 integration_replay_jobs — Replay tracking
CREATE TABLE IF NOT EXISTS public.integration_replay_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_account_id uuid REFERENCES public.integration_accounts(id) ON DELETE SET NULL,
  scope_type text NOT NULL CHECK (scope_type IN ('record', 'job', 'time_range', 'full_source')),
  scope_json jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  requested_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  result_json jsonb,
  error_json jsonb
);

CREATE INDEX IF NOT EXISTS idx_integration_replay_jobs_org
  ON public.integration_replay_jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_integration_replay_jobs_status
  ON public.integration_replay_jobs(status);

ALTER TABLE public.integration_replay_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY integration_replay_jobs_select ON public.integration_replay_jobs FOR SELECT
  USING (public.is_org_member(org_id));
CREATE POLICY integration_replay_jobs_insert ON public.integration_replay_jobs FOR INSERT
  WITH CHECK (public.is_org_member(org_id));
CREATE POLICY integration_replay_jobs_update ON public.integration_replay_jobs FOR UPDATE
  USING (public.is_org_member(org_id));
CREATE POLICY integration_replay_jobs_service ON public.integration_replay_jobs FOR ALL
  USING (auth.role() = 'service_role');

-- 8.5 integration_file_uploads — CSV file uploads
CREATE TABLE IF NOT EXISTS public.integration_file_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_account_id uuid REFERENCES public.integration_accounts(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  filename text NOT NULL,
  content_type text NOT NULL DEFAULT 'text/csv',
  row_count integer,
  status text NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'processed', 'failed')),
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_file_uploads_org
  ON public.integration_file_uploads(org_id);

ALTER TABLE public.integration_file_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY integration_file_uploads_select ON public.integration_file_uploads FOR SELECT
  USING (public.is_org_member(org_id));
CREATE POLICY integration_file_uploads_insert ON public.integration_file_uploads FOR INSERT
  WITH CHECK (public.is_org_member(org_id));
CREATE POLICY integration_file_uploads_update ON public.integration_file_uploads FOR UPDATE
  USING (public.is_org_member(org_id));
CREATE POLICY integration_file_uploads_service ON public.integration_file_uploads FOR ALL
  USING (auth.role() = 'service_role');

-- Extend integration_inbound_events source_channel for Phase 3 (optional; table may not exist in all envs)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'integration_inbound_events') THEN
    ALTER TABLE public.integration_inbound_events DROP CONSTRAINT IF EXISTS integration_inbound_events_source_channel_check;
    ALTER TABLE public.integration_inbound_events ADD CONSTRAINT integration_inbound_events_source_channel_check
      CHECK (source_channel IN ('webhook', 'sync', 'backfill', 'warehouse', 'internal', 'file_import', 'db_read'));
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; -- Ignore if constraint names differ
END $$;
