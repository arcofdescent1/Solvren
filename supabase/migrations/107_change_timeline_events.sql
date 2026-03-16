-- Task 16: Change Timeline & Activity Log
-- Unified chronological timeline for every change.

CREATE TABLE IF NOT EXISTS public.change_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  change_event_id uuid NOT NULL REFERENCES public.change_events(id) ON DELETE CASCADE,
  actor_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  title text NOT NULL,
  description text NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_change_timeline_events_change
  ON public.change_timeline_events(change_event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_change_timeline_events_org
  ON public.change_timeline_events(org_id, created_at DESC);

COMMENT ON TABLE public.change_timeline_events IS 'Human-readable chronological timeline for change governance and audit';

ALTER TABLE public.change_timeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY change_timeline_events_select ON public.change_timeline_events
  FOR SELECT USING (is_org_member(org_id));

CREATE POLICY change_timeline_events_insert ON public.change_timeline_events
  FOR INSERT WITH CHECK (is_org_member(org_id));
