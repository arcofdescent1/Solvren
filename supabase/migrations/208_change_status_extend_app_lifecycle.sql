-- Align Postgres change_status enum with application lifecycle (src/lib/changes/statuses.ts).
-- Production had only DRAFT, SUBMITTED, IN_REVIEW, APPROVED, REJECTED from early schema.

DO $$
DECLARE
  lb text;
  labels text[] := ARRAY['READY', 'CLOSED', 'RESOLVED'];
BEGIN
  FOREACH lb IN ARRAY labels LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
        AND t.typname = 'change_status'
        AND e.enumlabel = lb
    ) THEN
      EXECUTE format('ALTER TYPE public.change_status ADD VALUE %L', lb);
    END IF;
  END LOOP;
END $$;
