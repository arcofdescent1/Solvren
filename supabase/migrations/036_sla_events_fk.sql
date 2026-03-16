-- FK from sla_events to change_events (on delete cascade)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sla_events_change_event_id_fkey'
  ) THEN
    ALTER TABLE public.sla_events
      ADD CONSTRAINT sla_events_change_event_id_fkey
      FOREIGN KEY (change_event_id)
      REFERENCES public.change_events(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS sla_events_change_event_id_idx
  ON public.sla_events(change_event_id, created_at DESC);
