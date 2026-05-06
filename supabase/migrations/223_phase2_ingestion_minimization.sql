-- Phase 2 — Minimized payload columns (parallel write with legacy payload_json).

ALTER TABLE public.integration_inbound_events
  ADD COLUMN IF NOT EXISTS sanitized_payload jsonb NULL,
  ADD COLUMN IF NOT EXISTS payload_audit jsonb NULL,
  ADD COLUMN IF NOT EXISTS is_legacy boolean NOT NULL DEFAULT false;

ALTER TABLE public.integration_webhook_events
  ADD COLUMN IF NOT EXISTS sanitized_payload jsonb NULL,
  ADD COLUMN IF NOT EXISTS payload_audit jsonb NULL,
  ADD COLUMN IF NOT EXISTS is_legacy boolean NOT NULL DEFAULT false;

ALTER TABLE public.raw_events
  ADD COLUMN IF NOT EXISTS sanitized_payload jsonb NULL,
  ADD COLUMN IF NOT EXISTS payload_audit jsonb NULL,
  ADD COLUMN IF NOT EXISTS is_legacy boolean NOT NULL DEFAULT false;

ALTER TABLE public.integration_dead_letters
  ADD COLUMN IF NOT EXISTS sanitized_payload jsonb NULL,
  ADD COLUMN IF NOT EXISTS payload_audit jsonb NULL,
  ADD COLUMN IF NOT EXISTS is_legacy boolean NOT NULL DEFAULT false;

UPDATE public.integration_inbound_events
  SET is_legacy = true
  WHERE sanitized_payload IS NULL;

UPDATE public.integration_webhook_events
  SET is_legacy = true
  WHERE sanitized_payload IS NULL;

UPDATE public.raw_events
  SET is_legacy = true
  WHERE sanitized_payload IS NULL;

UPDATE public.integration_dead_letters
  SET is_legacy = true
  WHERE sanitized_payload IS NULL;
