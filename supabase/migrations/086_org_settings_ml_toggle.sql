-- Phase 4 Pass 2B — ML scoring toggle
ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS enable_ml_scoring boolean NOT NULL DEFAULT false;
