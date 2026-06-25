CREATE TABLE IF NOT EXISTS public.mcp_policy_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_key text NOT NULL,
  profile_name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'retired')),
  purpose text NULL,
  allowed_tools text[] NOT NULL DEFAULT '{}',
  allowed_mutations text[] NOT NULL DEFAULT '{}',
  allowed_org_ids text[] NOT NULL DEFAULT '{}',
  max_result_limit integer NOT NULL DEFAULT 50 CHECK (max_result_limit BETWEEN 1 AND 200),
  allowed_roles text[] NOT NULL DEFAULT '{}',
  allowed_email_domains text[] NOT NULL DEFAULT '{}',
  require_confirmation boolean NOT NULL DEFAULT true,
  action_ttl_minutes integer NOT NULL DEFAULT 10 CHECK (action_ttl_minutes BETWEEN 1 AND 120),
  redaction_level text NOT NULL DEFAULT 'standard' CHECK (redaction_level IN ('standard', 'strict', 'executive')),
  data_scopes text[] NOT NULL DEFAULT ARRAY['decisions', 'problems', 'proof', 'setup', 'audit'],
  audit_level text NOT NULL DEFAULT 'metadata' CHECK (audit_level IN ('metadata', 'summary', 'full_enterprise')),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, profile_key)
);

CREATE INDEX IF NOT EXISTS idx_mcp_policy_profiles_org_status
  ON public.mcp_policy_profiles(org_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.mcp_policy_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id uuid NULL REFERENCES public.mcp_policy_profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  actor_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  summary text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcp_policy_events_org_created
  ON public.mcp_policy_events(org_id, created_at DESC);

ALTER TABLE public.mcp_policy_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_policy_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mcp_policy_profiles_member_read ON public.mcp_policy_profiles;
CREATE POLICY mcp_policy_profiles_member_read
  ON public.mcp_policy_profiles
  FOR SELECT
  USING (is_org_member(org_id));

DROP POLICY IF EXISTS mcp_policy_profiles_service_write ON public.mcp_policy_profiles;
CREATE POLICY mcp_policy_profiles_service_write
  ON public.mcp_policy_profiles
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS mcp_policy_events_member_read ON public.mcp_policy_events;
CREATE POLICY mcp_policy_events_member_read
  ON public.mcp_policy_events
  FOR SELECT
  USING (is_org_member(org_id));

DROP POLICY IF EXISTS mcp_policy_events_service_write ON public.mcp_policy_events;
CREATE POLICY mcp_policy_events_service_write
  ON public.mcp_policy_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
