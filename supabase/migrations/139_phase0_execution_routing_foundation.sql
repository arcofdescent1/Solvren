-- Phase 0: routing_rules, execution_tasks

CREATE TABLE IF NOT EXISTS public.routing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  domain_key text NOT NULL,
  source_type text NULL,
  severity_min text NULL,
  conditions_json jsonb NOT NULL DEFAULT '{}',
  owner_type text NOT NULL,
  owner_ref text NOT NULL,
  sla_policy_key text NULL,
  escalation_policy_json jsonb NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_routing_rules_org ON public.routing_rules(org_id);

CREATE TABLE IF NOT EXISTS public.execution_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  external_system text NOT NULL,
  external_task_id text NULL,
  task_type text NOT NULL,
  status text NOT NULL,
  assignee_ref text NULL,
  due_at timestamptz NULL,
  sync_status text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_execution_tasks_issue_id ON public.execution_tasks(issue_id);
