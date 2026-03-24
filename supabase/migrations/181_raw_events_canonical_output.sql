-- Phase 1 — Add canonical output to raw_events for mapping layer integration.
ALTER TABLE public.raw_events ADD COLUMN IF NOT EXISTS canonical_output_json jsonb;
