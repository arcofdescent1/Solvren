-- Phase 1 — Add canonical output to raw_events for mapping layer integration.
-- Renumbered from 181_* (duplicate version with 181_phase3_advanced_ingestion.sql).

ALTER TABLE public.raw_events ADD COLUMN IF NOT EXISTS canonical_output_json jsonb;
