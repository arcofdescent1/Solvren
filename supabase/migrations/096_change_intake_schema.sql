-- Change intake schema: rollout_method, customer impact fields
-- (change_type, systems_involved, backfill_required already exist)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rollout_method') THEN
    CREATE TYPE public.rollout_method AS ENUM ('GRADUAL', 'IMMEDIATE');
  END IF;
END $$;

ALTER TABLE public.change_events
  ADD COLUMN IF NOT EXISTS structured_change_type text NULL,
  ADD COLUMN IF NOT EXISTS rollout_method text NULL,
  ADD COLUMN IF NOT EXISTS customer_impact_expected boolean NULL,
  ADD COLUMN IF NOT EXISTS affected_customer_segments text[] NULL,
  ADD COLUMN IF NOT EXISTS planned_release_at timestamptz NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'change_events_pct_customer_base_chk') THEN
    ALTER TABLE public.change_events
      ADD CONSTRAINT change_events_pct_customer_base_chk
      CHECK (percent_customer_base_affected IS NULL OR (percent_customer_base_affected >= 0 AND percent_customer_base_affected <= 100));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_change_events_org_planned_release
  ON public.change_events(org_id, planned_release_at);
