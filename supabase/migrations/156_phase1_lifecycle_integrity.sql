-- Phase 1 — Lifecycle Integrity & System Invariants
-- Authoritative lifecycle enforcement layer for issues.

-- 8.1 issues table additions
ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS lifecycle_state text NOT NULL DEFAULT 'DETECTED',
  ADD COLUMN IF NOT EXISTS lifecycle_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS terminal_reason text NULL,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS closed_by_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL;

-- Ensure reopen_count exists (may already exist from Phase 0)
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS reopen_count integer NOT NULL DEFAULT 0;

-- Constraint: lifecycle_state must be valid
ALTER TABLE public.issues DROP CONSTRAINT IF EXISTS issues_lifecycle_state_check;
ALTER TABLE public.issues ADD CONSTRAINT issues_lifecycle_state_check
  CHECK (lifecycle_state IN (
    'DETECTED', 'IMPACT_ESTIMATED', 'ACTION_PLANNED', 'ACTION_EXECUTED',
    'VERIFICATION_PENDING', 'VERIFIED_SUCCESS', 'VERIFIED_FAILURE',
    'NO_ACTION_TAKEN', 'CLOSED'
  ));

-- 8.2 issue_lifecycle_events (append-only audit trail)
CREATE TABLE IF NOT EXISTS public.issue_lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_state text NULL,
  to_state text NULL,
  event_reason text NULL,
  event_payload_json jsonb NOT NULL DEFAULT '{}',
  actor_type text NOT NULL CHECK (actor_type IN ('system', 'user', 'workflow', 'detector', 'verification_engine')),
  actor_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  correlation_id text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_lifecycle_events_issue_created
  ON public.issue_lifecycle_events(issue_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issue_lifecycle_events_org_created
  ON public.issue_lifecycle_events(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issue_lifecycle_events_type
  ON public.issue_lifecycle_events(event_type, created_at DESC);

-- 8.3 issue_terminal_classifications (required for closure)
CREATE TABLE IF NOT EXISTS public.issue_terminal_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  issue_id uuid NOT NULL UNIQUE REFERENCES public.issues(id) ON DELETE CASCADE,
  classification_type text NOT NULL CHECK (classification_type IN ('resolved_success', 'resolved_failure', 'no_action_closed')),
  outcome_summary text NOT NULL,
  outcome_payload_json jsonb NOT NULL DEFAULT '{}',
  created_by_type text NOT NULL CHECK (created_by_type IN ('system', 'user')),
  created_by_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_terminal_classifications_org ON public.issue_terminal_classifications(org_id);

-- 8.4 issue_no_action_decisions
CREATE TABLE IF NOT EXISTS public.issue_no_action_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  issue_id uuid NOT NULL UNIQUE REFERENCES public.issues(id) ON DELETE CASCADE,
  no_action_reason text NOT NULL CHECK (no_action_reason IN (
    'false_positive', 'duplicate_of_existing_issue', 'accepted_business_risk',
    'insufficient_permissions', 'external_blocker_unresolvable', 'customer_declined_action',
    'informational_only', 'test_or_demo_artifact'
  )),
  no_action_notes text NULL,
  requires_approval boolean NOT NULL DEFAULT false,
  approved_by_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_no_action_decisions_org ON public.issue_no_action_decisions(org_id);

-- RLS
ALTER TABLE public.issue_lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_terminal_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_no_action_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS issue_lifecycle_events_select ON public.issue_lifecycle_events;
CREATE POLICY issue_lifecycle_events_select ON public.issue_lifecycle_events FOR SELECT
  USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS issue_lifecycle_events_insert ON public.issue_lifecycle_events;
CREATE POLICY issue_lifecycle_events_insert ON public.issue_lifecycle_events FOR INSERT
  WITH CHECK (public.is_org_member(org_id));

DROP POLICY IF EXISTS issue_terminal_classifications_select ON public.issue_terminal_classifications;
CREATE POLICY issue_terminal_classifications_select ON public.issue_terminal_classifications FOR SELECT
  USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS issue_terminal_classifications_insert ON public.issue_terminal_classifications;
CREATE POLICY issue_terminal_classifications_insert ON public.issue_terminal_classifications FOR INSERT
  WITH CHECK (public.is_org_member(org_id));

DROP POLICY IF EXISTS issue_no_action_decisions_select ON public.issue_no_action_decisions;
CREATE POLICY issue_no_action_decisions_select ON public.issue_no_action_decisions FOR SELECT
  USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS issue_no_action_decisions_insert ON public.issue_no_action_decisions;
CREATE POLICY issue_no_action_decisions_insert ON public.issue_no_action_decisions FOR INSERT
  WITH CHECK (public.is_org_member(org_id));

-- Trigger: create ISSUE_DETECTED lifecycle event when issue is inserted
CREATE OR REPLACE FUNCTION public.issue_lifecycle_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  INSERT INTO public.issue_lifecycle_events (
    org_id, issue_id, event_type, from_state, to_state,
    event_reason, actor_type
  ) VALUES (
    NEW.org_id, NEW.id, 'ISSUE_DETECTED', NULL,
    COALESCE(NEW.lifecycle_state, 'DETECTED'),
    'issue_created', 'system'
  );
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_issue_lifecycle_on_insert ON public.issues;
CREATE TRIGGER trg_issue_lifecycle_on_insert
  AFTER INSERT ON public.issues
  FOR EACH ROW
  EXECUTE FUNCTION public.issue_lifecycle_on_insert();
