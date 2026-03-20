-- Phase 6 Deep Expansion: idempotency, writeback status, execution mode

-- execution_tasks: add columns for reliability model
ALTER TABLE public.execution_tasks
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS writeback_status text,
  ADD COLUMN IF NOT EXISTS execution_mode text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS retry_count int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_execution_tasks_idempotency ON public.execution_tasks(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- issue_actions: add columns
ALTER TABLE public.issue_actions
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS writeback_status text,
  ADD COLUMN IF NOT EXISTS execution_mode text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS risk_level text,
  ADD COLUMN IF NOT EXISTS affected_records int;

-- execution_playbooks: store playbook definitions
CREATE TABLE IF NOT EXISTS public.execution_playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  playbook_key text NOT NULL,
  display_name text NOT NULL,
  description text,
  trigger_domain text,
  trigger_source_type text,
  steps_json jsonb NOT NULL DEFAULT '[]',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, playbook_key)
);

CREATE INDEX IF NOT EXISTS idx_execution_playbooks_org ON public.execution_playbooks(org_id);

-- org approval policies (guardrails)
CREATE TABLE IF NOT EXISTS public.org_approval_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  risk_level_threshold text NOT NULL DEFAULT 'medium',
  requires_human boolean NOT NULL DEFAULT true,
  allowed_actions jsonb NOT NULL DEFAULT '[]',
  blocked_actions jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id)
);

-- RLS for execution_playbooks
ALTER TABLE public.execution_playbooks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS execution_playbooks_select ON public.execution_playbooks;
CREATE POLICY execution_playbooks_select ON public.execution_playbooks FOR SELECT
  USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS execution_playbooks_insert ON public.execution_playbooks;
CREATE POLICY execution_playbooks_insert ON public.execution_playbooks FOR INSERT
  WITH CHECK (public.is_org_member(org_id));
DROP POLICY IF EXISTS execution_playbooks_update ON public.execution_playbooks;
CREATE POLICY execution_playbooks_update ON public.execution_playbooks FOR UPDATE
  USING (public.is_org_member(org_id));

-- RLS for org_approval_policies
ALTER TABLE public.org_approval_policies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_approval_policies_select ON public.org_approval_policies;
CREATE POLICY org_approval_policies_select ON public.org_approval_policies FOR SELECT
  USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS org_approval_policies_insert ON public.org_approval_policies;
CREATE POLICY org_approval_policies_insert ON public.org_approval_policies FOR INSERT
  WITH CHECK (public.is_org_member(org_id));
DROP POLICY IF EXISTS org_approval_policies_update ON public.org_approval_policies;
CREATE POLICY org_approval_policies_update ON public.org_approval_policies FOR UPDATE
  USING (public.is_org_member(org_id));
