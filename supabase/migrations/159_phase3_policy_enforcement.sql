-- Phase 3 — Authoritative Policy Enforcement Layer

-- 12.1 policies — extend Phase 8 schema for Phase 3 DSL
-- Phase 8 policies exists; add Phase 3 columns
ALTER TABLE public.policies
  ADD COLUMN IF NOT EXISTS scope_ref text NULL,
  ADD COLUMN IF NOT EXISTS default_disposition text NOT NULL DEFAULT 'BLOCK',
  ADD COLUMN IF NOT EXISTS rules_json jsonb NOT NULL DEFAULT '[]';

-- Backfill scope_ref from scope_ref_json if needed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'policies' AND column_name = 'scope_ref_json') THEN
    UPDATE public.policies
    SET scope_ref = (scope_ref_json->>'key')::text
    WHERE scope_ref IS NULL AND scope_ref_json IS NOT NULL AND scope_ref_json != '{}'::jsonb;
  END IF;
END $$;

-- Backfill rules_json from policy_rules_json if needed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'policies' AND column_name = 'policy_rules_json') THEN
    UPDATE public.policies
    SET rules_json = policy_rules_json
    WHERE (rules_json = '[]'::jsonb OR rules_json IS NULL) AND policy_rules_json IS NOT NULL AND policy_rules_json != '[]'::jsonb;
  END IF;
END $$;

-- Allow org_id null for global policies
ALTER TABLE public.policies ALTER COLUMN org_id DROP NOT NULL;

-- Add scope column (Phase 3); keep policy_scope for Phase 8 compatibility
ALTER TABLE public.policies ADD COLUMN IF NOT EXISTS scope text NULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'policies' AND column_name = 'policy_scope') THEN
    UPDATE public.policies SET scope = policy_scope WHERE scope IS NULL AND policy_scope IS NOT NULL;
  END IF;
  UPDATE public.policies SET scope = COALESCE(scope, 'org') WHERE scope IS NULL;
END $$;
ALTER TABLE public.policies ALTER COLUMN scope SET DEFAULT 'org';

-- Ensure index exists for Phase 3 queries
CREATE INDEX IF NOT EXISTS idx_policies_org_scope_status ON public.policies(org_id, scope, status) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_policies_scope_status ON public.policies(scope, status) WHERE org_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_policies_key ON public.policies(policy_key);

-- 12.2 policy_decision_logs — append-only audit trail
CREATE TABLE IF NOT EXISTS public.policy_decision_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  issue_id uuid NULL REFERENCES public.issues(id) ON DELETE SET NULL,
  finding_id uuid NULL,

  action_key text NULL,
  playbook_key text NULL,
  workflow_step_key text NULL,

  evaluation_context_json jsonb NOT NULL DEFAULT '{}',
  matched_rules_json jsonb NOT NULL DEFAULT '[]',
  blocked_rules_json jsonb NOT NULL DEFAULT '[]',
  approval_rules_json jsonb NOT NULL DEFAULT '[]',

  final_disposition text NOT NULL,
  decision_reason_code text NOT NULL,
  decision_message text NOT NULL,

  effective_autonomy_mode text NOT NULL,
  required_approver_roles_json jsonb NOT NULL DEFAULT '[]',
  required_approval_count integer NOT NULL DEFAULT 0,

  applied_exception_ids_json jsonb NOT NULL DEFAULT '[]',

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_policy_decision_logs_org_created ON public.policy_decision_logs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_policy_decision_logs_issue ON public.policy_decision_logs(issue_id, created_at DESC) WHERE issue_id IS NOT NULL;

-- RLS
ALTER TABLE public.policy_decision_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS policy_decision_logs_select ON public.policy_decision_logs;
CREATE POLICY policy_decision_logs_select ON public.policy_decision_logs FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS policy_decision_logs_insert ON public.policy_decision_logs;
CREATE POLICY policy_decision_logs_insert ON public.policy_decision_logs FOR INSERT WITH CHECK (public.is_org_member(org_id));

-- 12.3 policy_exceptions — extend Phase 8 schema
ALTER TABLE public.policy_exceptions
  ADD COLUMN IF NOT EXISTS scope_json jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS override_effect_json jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Backfill scope_json from exception_scope_json
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'policy_exceptions' AND column_name = 'exception_scope_json') THEN
    UPDATE public.policy_exceptions
    SET scope_json = exception_scope_json
    WHERE scope_json = '{}'::jsonb AND exception_scope_json IS NOT NULL;
  END IF;
END $$;

-- RLS for policy_exceptions: add insert (Phase 8 only had select)
DROP POLICY IF EXISTS policy_exceptions_insert ON public.policy_exceptions;
CREATE POLICY policy_exceptions_insert ON public.policy_exceptions FOR INSERT WITH CHECK (public.is_org_member(org_id));

-- 12.4 approval_requests
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  issue_id uuid NULL REFERENCES public.issues(id) ON DELETE SET NULL,
  finding_id uuid NULL,
  action_key text NULL,
  playbook_key text NULL,
  workflow_run_id uuid NULL REFERENCES public.workflow_runs(id) ON DELETE SET NULL,

  requested_roles_json jsonb NOT NULL DEFAULT '[]',
  required_approval_count integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'canceled')),

  source_policy_decision_log_id uuid NOT NULL REFERENCES public.policy_decision_logs(id) ON DELETE CASCADE,
  request_payload_json jsonb NOT NULL DEFAULT '{}',

  created_by_type text NOT NULL,
  created_by_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_org_status ON public.approval_requests(org_id, status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_issue ON public.approval_requests(issue_id) WHERE issue_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_approval_requests_pending ON public.approval_requests(org_id, status) WHERE status = 'pending';

-- RLS
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY approval_requests_select ON public.approval_requests FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY approval_requests_insert ON public.approval_requests FOR INSERT WITH CHECK (public.is_org_member(org_id));
CREATE POLICY approval_requests_update ON public.approval_requests FOR UPDATE USING (public.is_org_member(org_id));
