-- Phase 2 Pass 1 — risk_explanation for explainability (base, learned, exposure, final)

ALTER TABLE public.change_events
  ADD COLUMN IF NOT EXISTS risk_explanation jsonb NULL DEFAULT '{}'::jsonb;
