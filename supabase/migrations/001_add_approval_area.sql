-- Add approval_area for typed approvals (Finance, RevOps, etc.)
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS approval_area text;

-- Backfill existing rows with unique values so we can add the unique constraint
UPDATE approvals SET approval_area = 'Legacy_' || id::text WHERE approval_area IS NULL;

ALTER TABLE approvals ALTER COLUMN approval_area SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_approvals_event_area ON approvals(change_event_id, approval_area);
