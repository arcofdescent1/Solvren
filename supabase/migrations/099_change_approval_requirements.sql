CREATE TABLE IF NOT EXISTS public.change_approval_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  change_event_id uuid NOT NULL REFERENCES public.change_events(id) ON DELETE CASCADE,
  approval_area text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (change_event_id, approval_area)
);
