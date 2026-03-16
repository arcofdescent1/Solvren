-- 039_audit_log.sql — add actor_type for USER | SYSTEM

alter table public.audit_log
  add column if not exists actor_type text not null default 'USER';

comment on column public.audit_log.actor_type is 'USER | SYSTEM';

drop policy if exists audit_log_select on public.audit_log;
drop policy if exists "audit_select_org" on public.audit_log;
create policy audit_log_select on public.audit_log
for select using (is_org_member(org_id));

drop policy if exists audit_log_insert on public.audit_log;
create policy audit_log_insert on public.audit_log
for insert with check (is_org_member(org_id));
