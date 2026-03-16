-- Ensure upsert on (change_event_id, approval_area) works.
-- Equivalent to idx_approvals_event_area from 001; explicit name for clarity.
CREATE UNIQUE INDEX IF NOT EXISTS approvals_unique_change_area
  ON approvals(change_event_id, approval_area);
