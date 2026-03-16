-- Future-proof approvals uniqueness: one row per (change_event_id, domain, approval_area).
-- Invariant: approvals.domain must match change_events.domain for that change.
DROP INDEX IF EXISTS approvals_unique_change_area;
DROP INDEX IF EXISTS idx_approvals_event_area;

CREATE UNIQUE INDEX IF NOT EXISTS approvals_unique_change_domain_area
  ON approvals(change_event_id, domain, approval_area);
