-- Add PLAN_LOGIC to revenue_surface enum (if type exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'revenue_surface') AND
     NOT EXISTS (SELECT 1 FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'revenue_surface' AND e.enumlabel = 'PLAN_LOGIC') THEN
    ALTER TYPE public.revenue_surface ADD VALUE 'PLAN_LOGIC';
  END IF;
END $$;
