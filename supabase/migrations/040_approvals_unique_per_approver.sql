-- Allow multiple approvers per (change_event_id, domain, approval_area) for min_count > 1.
-- Idempotent at DB level: one row per (change_event_id, domain, approval_area, approver_user_id).
DROP INDEX IF EXISTS approvals_unique_change_domain_area;

CREATE UNIQUE INDEX IF NOT EXISTS approvals_unique_change_domain_area_approver
  ON public.approvals(change_event_id, domain, approval_area, approver_user_id);
