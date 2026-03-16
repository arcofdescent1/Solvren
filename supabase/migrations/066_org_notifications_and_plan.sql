-- Phase 1B Pass 2 — Org notification prefs + plan tier
-- Plan tier on organizations (synced from Stripe via webhook; billing_accounts also has plan_key)
-- Notification prefs live in organization_settings + digest_settings (existing)

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'FREE';

CREATE INDEX IF NOT EXISTS idx_orgs_plan ON public.organizations(plan_tier);
