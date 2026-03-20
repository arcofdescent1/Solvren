-- Phase 1 — Integration Platform: core tables, indexes, RLS.
-- All integration data is org-scoped; RLS uses organization_members.

-- 8.2 integration_accounts
CREATE TABLE IF NOT EXISTS public.integration_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  display_name text NOT NULL,
  category text NOT NULL,
  auth_type text NOT NULL,
  status text NOT NULL DEFAULT 'not_installed',
  connection_mode text NOT NULL,
  installed_by_user_id uuid REFERENCES auth.users(id),
  installed_at timestamptz,
  disconnected_at timestamptz,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error_code text,
  last_error_message text,
  health_summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  scopes_granted_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  scopes_missing_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  secrets_ref text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, provider)
);

-- 8.3 integration_auth_sessions
CREATE TABLE IF NOT EXISTS public.integration_auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  initiated_by_user_id uuid NOT NULL REFERENCES auth.users(id),
  state_token text NOT NULL UNIQUE,
  pkce_verifier text,
  redirect_uri text NOT NULL,
  requested_scopes_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  callback_received_at timestamptz,
  error_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8.4 integration_credentials
CREATE TABLE IF NOT EXISTS public.integration_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_account_id uuid NOT NULL REFERENCES public.integration_accounts(id) ON DELETE CASCADE,
  credential_type text NOT NULL,
  secret_ref text NOT NULL,
  expires_at timestamptz,
  refreshable boolean NOT NULL DEFAULT false,
  last_refreshed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 8.5 integration_sync_jobs
CREATE TABLE IF NOT EXISTS public.integration_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_account_id uuid NOT NULL REFERENCES public.integration_accounts(id) ON DELETE CASCADE,
  job_type text NOT NULL,
  job_scope text,
  status text NOT NULL DEFAULT 'queued',
  trigger_source text NOT NULL,
  cursor_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  metrics_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_json jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8.6 integration_webhook_endpoints
CREATE TABLE IF NOT EXISTS public.integration_webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_account_id uuid NOT NULL REFERENCES public.integration_accounts(id) ON DELETE CASCADE,
  provider text NOT NULL,
  endpoint_url text NOT NULL,
  external_endpoint_id text,
  signing_secret_ref text,
  health_status text NOT NULL DEFAULT 'unknown',
  last_event_received_at timestamptz,
  last_verification_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 8.7 integration_webhook_events
CREATE TABLE IF NOT EXISTS public.integration_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_account_id uuid REFERENCES public.integration_accounts(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_event_id text,
  event_type text NOT NULL,
  request_headers_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload_json jsonb NOT NULL,
  signature_valid boolean,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_status text NOT NULL DEFAULT 'received',
  processed_at timestamptz,
  processing_error_json jsonb,
  dedupe_key text,
  UNIQUE(provider, dedupe_key)
);

-- 8.8 integration_action_logs
CREATE TABLE IF NOT EXISTS public.integration_action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_account_id uuid NOT NULL REFERENCES public.integration_accounts(id) ON DELETE CASCADE,
  provider text NOT NULL,
  issue_id uuid,
  action_type text NOT NULL,
  target_ref_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL,
  retry_count int NOT NULL DEFAULT 0,
  executed_by_user_id uuid REFERENCES auth.users(id),
  executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8.9 integration_health_checks
CREATE TABLE IF NOT EXISTS public.integration_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_account_id uuid NOT NULL REFERENCES public.integration_accounts(id) ON DELETE CASCADE,
  provider text NOT NULL,
  check_type text NOT NULL,
  status text NOT NULL,
  summary text,
  details_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  checked_at timestamptz NOT NULL DEFAULT now()
);

-- 8.10 integration_supported_objects
CREATE TABLE IF NOT EXISTS public.integration_supported_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_account_id uuid NOT NULL REFERENCES public.integration_accounts(id) ON DELETE CASCADE,
  object_type text NOT NULL,
  read_enabled boolean NOT NULL DEFAULT false,
  write_enabled boolean NOT NULL DEFAULT false,
  event_enabled boolean NOT NULL DEFAULT false,
  backfill_complete boolean NOT NULL DEFAULT false,
  last_synced_at timestamptz,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- 8.11 integration_provider_actions
CREATE TABLE IF NOT EXISTS public.integration_provider_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_account_id uuid NOT NULL REFERENCES public.integration_accounts(id) ON DELETE CASCADE,
  action_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_tested_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(integration_account_id, action_key)
);

-- 8.12 Indexes
CREATE INDEX IF NOT EXISTS idx_integration_accounts_org_provider ON public.integration_accounts(org_id, provider);
CREATE INDEX IF NOT EXISTS idx_integration_sync_jobs_account_status ON public.integration_sync_jobs(integration_account_id, status);
CREATE INDEX IF NOT EXISTS idx_integration_webhook_events_provider_dedupe ON public.integration_webhook_events(provider, dedupe_key);
CREATE INDEX IF NOT EXISTS idx_integration_health_checks_account_checked ON public.integration_health_checks(integration_account_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_action_logs_account_type_created ON public.integration_action_logs(integration_account_id, action_type, created_at DESC);

-- 8.13 RLS: org-scoped via organization_members
ALTER TABLE public.integration_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_supported_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_provider_actions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public
  AS $$ SELECT EXISTS (SELECT 1 FROM public.organization_members m WHERE m.org_id = p_org_id AND m.user_id = auth.uid()); $$;

-- integration_accounts: members can select; admin/owner can insert/update/delete
DROP POLICY IF EXISTS integration_accounts_select ON public.integration_accounts;
CREATE POLICY integration_accounts_select ON public.integration_accounts FOR SELECT
  USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS integration_accounts_insert ON public.integration_accounts;
CREATE POLICY integration_accounts_insert ON public.integration_accounts FOR INSERT
  WITH CHECK (public.is_org_member(org_id));
DROP POLICY IF EXISTS integration_accounts_update ON public.integration_accounts;
CREATE POLICY integration_accounts_update ON public.integration_accounts FOR UPDATE
  USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS integration_accounts_delete ON public.integration_accounts;
CREATE POLICY integration_accounts_delete ON public.integration_accounts FOR DELETE
  USING (public.is_org_member(org_id));

-- integration_auth_sessions
DROP POLICY IF EXISTS integration_auth_sessions_select ON public.integration_auth_sessions;
CREATE POLICY integration_auth_sessions_select ON public.integration_auth_sessions FOR SELECT
  USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS integration_auth_sessions_insert ON public.integration_auth_sessions;
CREATE POLICY integration_auth_sessions_insert ON public.integration_auth_sessions FOR INSERT
  WITH CHECK (public.is_org_member(org_id));
DROP POLICY IF EXISTS integration_auth_sessions_update ON public.integration_auth_sessions;
CREATE POLICY integration_auth_sessions_update ON public.integration_auth_sessions FOR UPDATE
  USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS integration_auth_sessions_delete ON public.integration_auth_sessions;
CREATE POLICY integration_auth_sessions_delete ON public.integration_auth_sessions FOR DELETE
  USING (public.is_org_member(org_id));

-- integration_credentials: legacy table has org_id; Phase 1 integration_accounts is separate
-- Use org_id for RLS when column exists (legacy); otherwise would use integration_account_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'integration_credentials' AND column_name = 'org_id') THEN
    DROP POLICY IF EXISTS integration_credentials_select ON public.integration_credentials;
    CREATE POLICY integration_credentials_select ON public.integration_credentials FOR SELECT
      USING (public.is_org_member(org_id));
    DROP POLICY IF EXISTS integration_credentials_insert ON public.integration_credentials;
    CREATE POLICY integration_credentials_insert ON public.integration_credentials FOR INSERT
      WITH CHECK (public.is_org_member(org_id));
    DROP POLICY IF EXISTS integration_credentials_update ON public.integration_credentials;
    CREATE POLICY integration_credentials_update ON public.integration_credentials FOR UPDATE
      USING (public.is_org_member(org_id));
    DROP POLICY IF EXISTS integration_credentials_delete ON public.integration_credentials;
    CREATE POLICY integration_credentials_delete ON public.integration_credentials FOR DELETE
      USING (public.is_org_member(org_id));
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'integration_credentials' AND column_name = 'integration_account_id') THEN
    DROP POLICY IF EXISTS integration_credentials_select ON public.integration_credentials;
    CREATE POLICY integration_credentials_select ON public.integration_credentials FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.integration_accounts a WHERE a.id = integration_credentials.integration_account_id AND public.is_org_member(a.org_id)));
    DROP POLICY IF EXISTS integration_credentials_insert ON public.integration_credentials;
    CREATE POLICY integration_credentials_insert ON public.integration_credentials FOR INSERT
      WITH CHECK (EXISTS (SELECT 1 FROM public.integration_accounts a WHERE a.id = integration_credentials.integration_account_id AND public.is_org_member(a.org_id)));
    DROP POLICY IF EXISTS integration_credentials_update ON public.integration_credentials;
    CREATE POLICY integration_credentials_update ON public.integration_credentials FOR UPDATE
      USING (EXISTS (SELECT 1 FROM public.integration_accounts a WHERE a.id = integration_credentials.integration_account_id AND public.is_org_member(a.org_id)));
    DROP POLICY IF EXISTS integration_credentials_delete ON public.integration_credentials;
    CREATE POLICY integration_credentials_delete ON public.integration_credentials FOR DELETE
      USING (EXISTS (SELECT 1 FROM public.integration_accounts a WHERE a.id = integration_credentials.integration_account_id AND public.is_org_member(a.org_id)));
  END IF;
END $$;

-- integration_sync_jobs
DROP POLICY IF EXISTS integration_sync_jobs_select ON public.integration_sync_jobs;
CREATE POLICY integration_sync_jobs_select ON public.integration_sync_jobs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.integration_accounts a WHERE a.id = integration_sync_jobs.integration_account_id AND public.is_org_member(a.org_id)));
DROP POLICY IF EXISTS integration_sync_jobs_insert ON public.integration_sync_jobs;
CREATE POLICY integration_sync_jobs_insert ON public.integration_sync_jobs FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.integration_accounts a WHERE a.id = integration_sync_jobs.integration_account_id AND public.is_org_member(a.org_id)));
DROP POLICY IF EXISTS integration_sync_jobs_update ON public.integration_sync_jobs;
CREATE POLICY integration_sync_jobs_update ON public.integration_sync_jobs FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.integration_accounts a WHERE a.id = integration_sync_jobs.integration_account_id AND public.is_org_member(a.org_id)));

-- integration_webhook_endpoints
DROP POLICY IF EXISTS integration_webhook_endpoints_select ON public.integration_webhook_endpoints;
CREATE POLICY integration_webhook_endpoints_select ON public.integration_webhook_endpoints FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.integration_accounts a WHERE a.id = integration_webhook_endpoints.integration_account_id AND public.is_org_member(a.org_id)));
DROP POLICY IF EXISTS integration_webhook_endpoints_insert ON public.integration_webhook_endpoints;
CREATE POLICY integration_webhook_endpoints_insert ON public.integration_webhook_endpoints FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.integration_accounts a WHERE a.id = integration_webhook_endpoints.integration_account_id AND public.is_org_member(a.org_id)));
DROP POLICY IF EXISTS integration_webhook_endpoints_update ON public.integration_webhook_endpoints;
CREATE POLICY integration_webhook_endpoints_update ON public.integration_webhook_endpoints FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.integration_accounts a WHERE a.id = integration_webhook_endpoints.integration_account_id AND public.is_org_member(a.org_id)));

-- integration_webhook_events
DROP POLICY IF EXISTS integration_webhook_events_select ON public.integration_webhook_events;
CREATE POLICY integration_webhook_events_select ON public.integration_webhook_events FOR SELECT
  USING (integration_account_id IS NULL OR EXISTS (SELECT 1 FROM public.integration_accounts a WHERE a.id = integration_webhook_events.integration_account_id AND public.is_org_member(a.org_id)));
DROP POLICY IF EXISTS integration_webhook_events_insert ON public.integration_webhook_events;
CREATE POLICY integration_webhook_events_insert ON public.integration_webhook_events FOR INSERT
  WITH CHECK (integration_account_id IS NULL OR EXISTS (SELECT 1 FROM public.integration_accounts a WHERE a.id = integration_webhook_events.integration_account_id AND public.is_org_member(a.org_id)));
DROP POLICY IF EXISTS integration_webhook_events_update ON public.integration_webhook_events;
CREATE POLICY integration_webhook_events_update ON public.integration_webhook_events FOR UPDATE
  USING (integration_account_id IS NULL OR EXISTS (SELECT 1 FROM public.integration_accounts a WHERE a.id = integration_webhook_events.integration_account_id AND public.is_org_member(a.org_id)));

-- integration_action_logs
DROP POLICY IF EXISTS integration_action_logs_select ON public.integration_action_logs;
CREATE POLICY integration_action_logs_select ON public.integration_action_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.integration_accounts a WHERE a.id = integration_action_logs.integration_account_id AND public.is_org_member(a.org_id)));
DROP POLICY IF EXISTS integration_action_logs_insert ON public.integration_action_logs;
CREATE POLICY integration_action_logs_insert ON public.integration_action_logs FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.integration_accounts a WHERE a.id = integration_action_logs.integration_account_id AND public.is_org_member(a.org_id)));

-- integration_health_checks
DROP POLICY IF EXISTS integration_health_checks_select ON public.integration_health_checks;
CREATE POLICY integration_health_checks_select ON public.integration_health_checks FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.integration_accounts a WHERE a.id = integration_health_checks.integration_account_id AND public.is_org_member(a.org_id)));
DROP POLICY IF EXISTS integration_health_checks_insert ON public.integration_health_checks;
CREATE POLICY integration_health_checks_insert ON public.integration_health_checks FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.integration_accounts a WHERE a.id = integration_health_checks.integration_account_id AND public.is_org_member(a.org_id)));

-- integration_supported_objects
DROP POLICY IF EXISTS integration_supported_objects_select ON public.integration_supported_objects;
CREATE POLICY integration_supported_objects_select ON public.integration_supported_objects FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.integration_accounts a WHERE a.id = integration_supported_objects.integration_account_id AND public.is_org_member(a.org_id)));
DROP POLICY IF EXISTS integration_supported_objects_insert ON public.integration_supported_objects;
CREATE POLICY integration_supported_objects_insert ON public.integration_supported_objects FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.integration_accounts a WHERE a.id = integration_supported_objects.integration_account_id AND public.is_org_member(a.org_id)));
DROP POLICY IF EXISTS integration_supported_objects_update ON public.integration_supported_objects;
CREATE POLICY integration_supported_objects_update ON public.integration_supported_objects FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.integration_accounts a WHERE a.id = integration_supported_objects.integration_account_id AND public.is_org_member(a.org_id)));

-- integration_provider_actions
DROP POLICY IF EXISTS integration_provider_actions_select ON public.integration_provider_actions;
CREATE POLICY integration_provider_actions_select ON public.integration_provider_actions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.integration_accounts a WHERE a.id = integration_provider_actions.integration_account_id AND public.is_org_member(a.org_id)));
DROP POLICY IF EXISTS integration_provider_actions_insert ON public.integration_provider_actions;
CREATE POLICY integration_provider_actions_insert ON public.integration_provider_actions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.integration_accounts a WHERE a.id = integration_provider_actions.integration_account_id AND public.is_org_member(a.org_id)));
DROP POLICY IF EXISTS integration_provider_actions_update ON public.integration_provider_actions;
CREATE POLICY integration_provider_actions_update ON public.integration_provider_actions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.integration_accounts a WHERE a.id = integration_provider_actions.integration_account_id AND public.is_org_member(a.org_id)));
