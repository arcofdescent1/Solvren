-- Phase 4 — Extend integration_inbound_events for replay, downstream link, reconcile/CDC sources.

-- Add reconcile and salesforce_cdc to source_channel
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'integration_inbound_events') THEN
    ALTER TABLE public.integration_inbound_events DROP CONSTRAINT IF EXISTS integration_inbound_events_source_channel_check;
    ALTER TABLE public.integration_inbound_events ADD CONSTRAINT integration_inbound_events_source_channel_check
      CHECK (source_channel IN ('webhook', 'sync', 'backfill', 'warehouse', 'internal', 'reconcile', 'salesforce_cdc'));
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add replay and downstream columns
ALTER TABLE public.integration_inbound_events
  ADD COLUMN IF NOT EXISTS downstream_raw_event_id uuid REFERENCES public.raw_events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS replayed_at timestamptz,
  ADD COLUMN IF NOT EXISTS replay_reason text,
  ADD COLUMN IF NOT EXISTS replay_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_integration_inbound_events_downstream
  ON public.integration_inbound_events(downstream_raw_event_id) WHERE downstream_raw_event_id IS NOT NULL;
