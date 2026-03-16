-- 041: Audit log — remove global-org exception, add entity+created index; Approvals — allow multiple approvers per area.

-- Audit log: use only is_org_member(org_id) (no 0000… exception)
drop policy if exists audit_log_select on public.audit_log;
drop policy if exists "audit_select_org" on public.audit_log;
create policy audit_log_select on public.audit_log
  for select using (is_org_member(org_id));

drop policy if exists audit_log_insert on public.audit_log;
create policy audit_log_insert on public.audit_log
  for insert with check (is_org_member(org_id));

-- Index for Audit tab: (org_id, entity_type, entity_id, created_at desc)
create index if not exists idx_audit_log_entity_created
  on public.audit_log (org_id, entity_type, entity_id, created_at desc);

-- Approvals: allow min_count > 1 (multiple rows per approval_area)
drop index if exists idx_approvals_event_area;
drop index if exists approvals_unique_change_domain_area;
drop index if exists approvals_unique_change_domain_area_approver;

create unique index if not exists idx_approvals_event_area_user
  on public.approvals (change_event_id, approval_area, approver_user_id);
