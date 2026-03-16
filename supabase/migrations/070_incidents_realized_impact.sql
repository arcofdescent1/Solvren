-- Phase 2 Pass 2: Realized incident impact (dollars + timing)

ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS realized_mrr_impact numeric NULL,
  ADD COLUMN IF NOT EXISTS realized_revenue_impact numeric NULL,
  ADD COLUMN IF NOT EXISTS impact_currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS impact_notes text NULL,
  ADD COLUMN IF NOT EXISTS occurred_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_incidents_org_occurred
  ON public.incidents(org_id, occurred_at DESC)
  WHERE occurred_at IS NOT NULL;
