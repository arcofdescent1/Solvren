-- Phase 1A Pass 1 — Revenue Exposure Model
-- revenue_surface enum + constraints + index
-- (046 may have added some columns; this ensures enum + guardrails)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'revenue_surface') THEN
    CREATE TYPE public.revenue_surface AS ENUM (
      'PRICING',
      'BILLING',
      'PAYMENTS',
      'SUBSCRIPTIONS',
      'ENTITLEMENTS',
      'CHECKOUT',
      'TAX',
      'PROMOTIONS',
      'INVOICING',
      'OTHER'
    );
  END IF;
END $$;

-- Ensure exposure columns exist (046 may have added as text)
ALTER TABLE public.change_events
  ADD COLUMN IF NOT EXISTS estimated_mrr_affected numeric NULL,
  ADD COLUMN IF NOT EXISTS percent_customer_base_affected numeric NULL;

-- 046 uses revenue_surface text; app maps to enum values
-- Basic input guardrails
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'change_events_percent_customer_base_affected_range'
  ) THEN
    ALTER TABLE public.change_events
      ADD CONSTRAINT change_events_percent_customer_base_affected_range
      CHECK (
        percent_customer_base_affected IS NULL OR
        (percent_customer_base_affected >= 0 AND percent_customer_base_affected <= 100)
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'change_events_estimated_mrr_affected_nonnegative'
  ) THEN
    ALTER TABLE public.change_events
      ADD CONSTRAINT change_events_estimated_mrr_affected_nonnegative
      CHECK (
        estimated_mrr_affected IS NULL OR
        estimated_mrr_affected >= 0
      );
  END IF;
END $$;

-- Index for executive queries (revenue-focused)
CREATE INDEX IF NOT EXISTS idx_change_events_revenue_fields
  ON public.change_events(org_id, submitted_at DESC)
  WHERE estimated_mrr_affected IS NOT NULL
     OR percent_customer_base_affected IS NOT NULL
     OR revenue_surface IS NOT NULL
     OR revenue_surface IS NOT NULL;
