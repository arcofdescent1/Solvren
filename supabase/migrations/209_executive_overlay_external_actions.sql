-- Executive overlay v2: DENY decision, change flags, optional email action tokens

-- 1) executive_change_decisions: add DENY
ALTER TABLE public.executive_change_decisions
  DROP CONSTRAINT IF EXISTS executive_change_decisions_decision_check;

ALTER TABLE public.executive_change_decisions
  ADD CONSTRAINT executive_change_decisions_decision_check
  CHECK (decision IN ('APPROVE', 'DENY', 'DELAY', 'ESCALATE', 'REQUEST_INFO'));

COMMENT ON CONSTRAINT executive_change_decisions_decision_check ON public.executive_change_decisions IS
  'Executive overlay only; domain approvals stay on public.approvals (PENDING/APPROVED/REJECTED).';

-- 2) change_events: executive block + snooze (overlay UX; release still gated by domain)
ALTER TABLE public.change_events
  ADD COLUMN IF NOT EXISTS executive_blocked boolean NOT NULL DEFAULT false;

ALTER TABLE public.change_events
  ADD COLUMN IF NOT EXISTS executive_snooze_until timestamptz NULL;

COMMENT ON COLUMN public.change_events.executive_blocked IS
  'Executive DENY / block overlay; does not mutate domain approvals.';

COMMENT ON COLUMN public.change_events.executive_snooze_until IS
  'Executive DELAY: reminder / attention snooze until this time (notification semantics).';

CREATE INDEX IF NOT EXISTS idx_change_events_executive_blocked
  ON public.change_events (org_id, executive_blocked)
  WHERE executive_blocked = true;

-- 3) Org: opt-in executive action emails (signed links)
ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS executive_action_emails_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.organization_settings.executive_action_emails_enabled IS
  'When true and email is configured, executives also receive tokenized executive-action links.';

-- 4) Single-use tokens for email (and future) executive actions — service role writes
CREATE TABLE IF NOT EXISTS public.external_action_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  change_event_id uuid NOT NULL REFERENCES public.change_events(id) ON DELETE CASCADE,
  action_scope text NOT NULL DEFAULT 'EXECUTIVE_DECISION'
    CHECK (action_scope = 'EXECUTIVE_DECISION'),
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_external_action_tokens_org_change
  ON public.external_action_tokens (org_id, change_event_id);

CREATE INDEX IF NOT EXISTS idx_external_action_tokens_expires
  ON public.external_action_tokens (expires_at)
  WHERE used_at IS NULL;

ALTER TABLE public.external_action_tokens ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.external_action_tokens IS
  'Opaque hashed tokens for one-click executive actions outside the web session (email).';
