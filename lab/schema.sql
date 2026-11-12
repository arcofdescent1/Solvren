-- SYNTHETIC RECOVERY LAB ONLY. Derived from 65 immutable Solvren migrations.
-- Owner email replaced by recovery-operator@example.invalid. No customer records included.
set solvren.foundation_bootstrap='isolated-foundation';
-- Source: 202611110001_catalog_foundation.sql
-- NEW database only. Never replay on legacy Solvren. The test runner sets this guard.
do $$ begin
 if current_setting('solvren.foundation_bootstrap',true) is distinct from 'isolated-foundation' then
  raise exception 'Foundation migration requires an explicitly isolated database';
 end if;
end $$;

create table public.organizations (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 1 and 120),
 created_at timestamptz not null default now()
);
create table public.memberships (
 org_id uuid not null references public.organizations(id),
 user_id uuid not null references auth.users(id),
 role text not null check(role in ('owner','admin','contributor','approver','viewer')),
 created_at timestamptz not null default now(),
 primary key(org_id,user_id)
);
create index memberships_user on public.memberships(user_id,org_id);
create function public.catalog_role(target_org uuid) returns text
 language sql stable security definer set search_path = '' as $$
 select m.role from public.memberships m where m.org_id=target_org and m.user_id=auth.uid()
$$;
revoke all on function public.catalog_role(uuid) from public;
grant execute on function public.catalog_role(uuid) to authenticated;

create table public.catalog_profile_versions (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id),
 name text not null, version integer not null check(version>0),
 schema_definition jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 unique(org_id,id), unique(org_id,name,version)
);
create table public.catalog_jobs (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id),
 title text not null check(length(trim(title)) between 1 and 120),
 status text not null default 'draft' check(status in ('draft','submitted','scoping','awaiting_approval','queued','processing','quality_review','awaiting_customer','ready_for_review','accepted','closed','cancelled')),
 profile_version_id uuid,
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 unique(org_id,id),
 foreign key(org_id,profile_version_id) references public.catalog_profile_versions(org_id,id)
);
create index catalog_jobs_org_created on public.catalog_jobs(org_id,created_at desc);
create table public.source_files (
 id uuid primary key default gen_random_uuid(), org_id uuid not null, job_id uuid not null,
 original_name text not null, object_key text not null unique,
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 state text not null default 'quarantined' check(state in ('quarantined','ready','rejected')),
 created_at timestamptz not null default now(),
 foreign key(org_id,job_id) references public.catalog_jobs(org_id,id)
);
-- No bucket or upload permission is provisioned in Phase 0.
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.catalog_profile_versions enable row level security;
alter table public.catalog_jobs enable row level security;
alter table public.source_files enable row level security;
create policy organizations_read on public.organizations for select to authenticated using(public.catalog_role(id) is not null);
create policy memberships_read on public.memberships for select to authenticated using(user_id=auth.uid());
create policy profiles_read on public.catalog_profile_versions for select to authenticated using(public.catalog_role(org_id) is not null);
create policy jobs_read on public.catalog_jobs for select to authenticated using(public.catalog_role(org_id) is not null);
create policy jobs_create on public.catalog_jobs for insert to authenticated with check(
 public.catalog_role(org_id) in ('owner','admin','contributor') and created_by=auth.uid() and status='draft'
);
create policy files_read on public.source_files for select to authenticated using(public.catalog_role(org_id) is not null and state='ready');
revoke all on public.organizations,public.memberships,public.catalog_profile_versions,public.catalog_jobs,public.source_files from anon,authenticated;
grant select on public.organizations,public.memberships,public.catalog_profile_versions,public.catalog_jobs,public.source_files to authenticated;
grant insert on public.catalog_jobs to authenticated;
-- Membership mutation, approvals, release and storage access deliberately have no public grants.

-- Source: 202611110002_workspace_intake.sql
-- Apply only through the pinned staging migration runner.
alter table public.organizations add column created_by uuid references auth.users(id);
create unique index organizations_creator on public.organizations(created_by);
alter table public.catalog_jobs add column outcome text not null default '' check(length(outcome)<=4000);
alter table public.catalog_jobs add column target_template text not null default '' check(length(target_template)<=2000);
alter table public.catalog_jobs add column revision integer not null default 0;
alter table public.catalog_jobs add column updated_at timestamptz not null default now();
alter table public.catalog_jobs add column submitted_at timestamptz;
create table public.job_events (
 id uuid primary key default gen_random_uuid(),org_id uuid not null,job_id uuid not null,
 actor_id uuid not null references auth.users(id),event_type text not null,
 revision integer not null,created_at timestamptz not null default now(),
 foreign key(org_id,job_id) references public.catalog_jobs(org_id,id),
 unique(job_id,event_type,revision)
);
alter table public.job_events enable row level security;
revoke all on public.job_events from anon,authenticated;
grant select on public.job_events to authenticated;
create policy events_read on public.job_events for select to authenticated using(public.catalog_role(org_id) is not null);

create function public.create_catalog_workspace(workspace_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); workspace uuid;
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then raise exception 'Verified account required' using errcode='42501'; end if;
 if workspace_name is null or length(trim(workspace_name)) not between 1 and 120 then raise exception 'Invalid workspace name' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 select org_id into workspace from public.memberships where user_id=actor order by created_at,org_id limit 1;
 if workspace is not null then return workspace; end if;
 insert into public.organizations(name,created_by) values(trim(workspace_name),actor) returning id into workspace;
 insert into public.memberships(org_id,user_id,role) values(workspace,actor,'owner');
 return workspace;
end $$;

create function public.save_catalog_draft(workspace uuid,job uuid,expected_revision integer,job_title text,job_outcome text,destination text) returns public.catalog_jobs
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); access_role text; result public.catalog_jobs;
begin
 access_role:=public.catalog_role(workspace);
 if actor is null or access_role is null or access_role not in ('owner','admin','contributor') then raise exception 'Not allowed' using errcode='42501'; end if;
 if job is null or job_title is null or length(trim(job_title)) not between 1 and 120 or job_outcome is null or length(job_outcome)>4000 or destination is null or length(destination)>2000 or expected_revision is null or expected_revision<0 then raise exception 'Invalid draft' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(job::text,1));
 select * into result from public.catalog_jobs where id=job for update;
 if found then
  if result.org_id<>workspace or (access_role='contributor' and result.created_by<>actor) then raise exception 'Not allowed' using errcode='42501'; end if;
  if result.status<>'draft' or result.revision<>expected_revision then raise exception 'Draft changed; reload before saving' using errcode='40001'; end if;
  update public.catalog_jobs set title=trim(job_title),outcome=job_outcome,target_template=destination,revision=revision+1,updated_at=now() where id=job returning * into result;
 else
  if expected_revision<>0 then raise exception 'Draft changed; reload before saving' using errcode='40001'; end if;
  insert into public.catalog_jobs(id,org_id,created_by,title,outcome,target_template,revision) values(job,workspace,actor,trim(job_title),job_outcome,destination,1) returning * into result;
 end if;
 insert into public.job_events(org_id,job_id,actor_id,event_type,revision) values(workspace,job,actor,'draft_saved',result.revision);
 return result;
end $$;

create function public.submit_catalog_job(job uuid,expected_revision integer) returns public.catalog_jobs
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); access_role text; result public.catalog_jobs;
begin
 select * into result from public.catalog_jobs where id=job for update;
 if not found then raise exception 'Not allowed' using errcode='42501'; end if;
 access_role:=public.catalog_role(result.org_id);
 if actor is null or access_role is null or access_role not in ('owner','admin','contributor') or (access_role='contributor' and result.created_by<>actor) then raise exception 'Not allowed' using errcode='42501'; end if;
 if result.status='submitted' then return result; end if;
 if result.status<>'draft' or expected_revision is null or result.revision<>expected_revision then raise exception 'Draft changed; reload before submitting' using errcode='40001'; end if;
 if length(trim(result.outcome))=0 or length(trim(result.target_template))=0 then raise exception 'Add an outcome and destination before submitting' using errcode='22023'; end if;
 update public.catalog_jobs set status='submitted',revision=revision+1,submitted_at=now(),updated_at=now() where id=job returning * into result;
 insert into public.job_events(org_id,job_id,actor_id,event_type,revision) values(result.org_id,job,actor,'submitted',result.revision);
 return result;
end $$;
revoke all on function public.create_catalog_workspace(text),public.save_catalog_draft(uuid,uuid,integer,text,text,text),public.submit_catalog_job(uuid,integer) from public,anon;
grant execute on function public.create_catalog_workspace(text),public.save_catalog_draft(uuid,uuid,integer,text,text,text),public.submit_catalog_job(uuid,integer) to authenticated;

-- Source: 202611110003_intake_conflict_codes.sql
-- Stale user revisions are business conflicts, not retryable DB serialization failures.
do $$
begin
 execute replace(pg_get_functiondef('public.save_catalog_draft(uuid,uuid,integer,text,text,text)'::regprocedure),'''40001''','''PT409''');
 execute replace(pg_get_functiondef('public.submit_catalog_job(uuid,integer)'::regprocedure),'''40001''','''PT409''');
end $$;

-- Source: 202611110004_staff_boundary.sql
-- Staff identity is independent of customer membership and dashboard ownership.
create schema if not exists solvren_private;
revoke all on schema solvren_private from public,anon,authenticated;
create table solvren_private.operator_allowlist (
 email text primary key check(email=lower(trim(email))),
 enabled boolean not null default true,
 created_at timestamptz not null default now()
);
create table solvren_private.staff_members (
 user_id uuid primary key references auth.users(id),
 enabled boolean not null default true,
 created_at timestamptz not null default now()
);
create table solvren_private.staff_assignments (
 job_id uuid not null references public.catalog_jobs(id),
 user_id uuid not null references solvren_private.staff_members(user_id),
 can_review boolean not null default false,
 created_at timestamptz not null default now(),
 primary key(job_id,user_id)
);
revoke all on all tables in schema solvren_private from public,anon,authenticated;
create function public.activate_catalog_operator() returns boolean
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null or (auth.jwt()->>'aal') is distinct from 'aal2' then raise exception 'Verified MFA session required' using errcode='42501'; end if;
 if not exists(select 1 from auth.users u join solvren_private.operator_allowlist a on a.email=lower(u.email) where u.id=actor and u.email_confirmed_at is not null and a.enabled) then raise exception 'Operator access not authorized' using errcode='42501'; end if;
 insert into solvren_private.staff_members(user_id) values(actor) on conflict(user_id) do nothing;
 return exists(select 1 from solvren_private.staff_members where user_id=actor and enabled);
end $$;
create function public.catalog_staff_access(target_job uuid,require_review boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(auth.jwt()->>'aal'='aal2',false) and exists(
  select 1 from solvren_private.staff_members s
  join auth.users u on u.id=s.user_id
  join solvren_private.operator_allowlist a on a.email=lower(u.email) and a.enabled
  join solvren_private.staff_assignments j on j.user_id=s.user_id
  where s.user_id=auth.uid() and s.enabled and u.email_confirmed_at is not null
   and j.job_id=target_job and (not require_review or j.can_review)
 )
$$;
revoke all on function public.activate_catalog_operator(),public.catalog_staff_access(uuid,boolean) from public,anon;
grant execute on function public.activate_catalog_operator(),public.catalog_staff_access(uuid,boolean) to authenticated;
-- No staff data policies or file access are enabled by this boundary alone.

-- Source: 202611110005_private_files.sql
-- Private immutable objects. Clients can reserve and insert once, never mark clean.
alter table public.job_events add column details jsonb not null default '{}'::jsonb;
alter table public.source_files add column byte_size bigint not null default 0;
alter table public.source_files add column uploaded_by uuid references auth.users(id);
alter table public.source_files add column expires_at timestamptz not null default (now()+interval '30 minutes');
alter table public.source_files add column scan_attempts integer not null default 0;
alter table public.source_files add column scan_checked_at timestamptz;
alter table public.source_files add column scan_engine text;
alter table public.source_files add column scan_reason text;
alter table public.source_files add constraint source_file_size check(byte_size between 0 and 10485760);
insert into storage.buckets(id,name,public,file_size_limit) values('catalog-private','catalog-private',false,10485760)
on conflict(id) do nothing;
drop policy files_read on public.source_files;
create policy files_read on public.source_files for select to authenticated using(public.catalog_role(org_id) is not null or public.catalog_staff_access(job_id));
create policy catalog_object_insert on storage.objects for insert to authenticated with check(
 bucket_id='catalog-private' and exists(select 1 from public.source_files f join public.catalog_jobs j on j.id=f.job_id
 where f.object_key=name and f.uploaded_by=auth.uid() and f.state='quarantined' and f.expires_at>now()
 and j.status in ('draft','submitted','scoping','awaiting_customer') and public.catalog_role(f.org_id) in ('owner','admin','contributor'))
);
create policy catalog_object_read on storage.objects for select to authenticated using(
 bucket_id='catalog-private' and exists(select 1 from public.source_files f where f.object_key=name and f.state='ready'
 and (public.catalog_role(f.org_id) is not null or public.catalog_staff_access(f.job_id)))
);
create function public.reserve_catalog_file(target_job uuid,file_name text,file_bytes bigint,file_hash text) returns public.source_files
language plpgsql security definer set search_path='' as $$
declare j public.catalog_jobs; f public.source_files; actor uuid:=auth.uid();
begin
 select * into j from public.catalog_jobs where id=target_job for update;
 if actor is null or j.id is null or public.catalog_role(j.org_id) not in ('owner','admin','contributor') or public.catalog_role(j.org_id) is null
 or (public.catalog_role(j.org_id)='contributor' and j.created_by<>actor) then raise exception 'Not available' using errcode='42501'; end if;
 if j.status not in ('draft','submitted','scoping','awaiting_customer') then raise exception 'Uploads closed for this job' using errcode='22023'; end if;
 if file_bytes not between 1 and 10485760 or file_hash !~ '^[a-f0-9]{64}$' or file_name !~* '^[^/\\[:cntrl:]]{1,180}\.(csv|xlsx|pdf|png|jpg|jpeg)$' then raise exception 'Unsupported file or size' using errcode='22023'; end if;
 if (select count(*) from public.source_files where job_id=j.id and (state='ready' or (state='quarantined' and expires_at>now())))>=20 then raise exception 'Job file limit reached' using errcode='22023'; end if;
 insert into public.source_files(org_id,job_id,original_name,object_key,sha256,byte_size,uploaded_by)
 values(j.org_id,j.id,file_name,j.org_id::text||'/'||j.id::text||'/'||gen_random_uuid()::text,file_hash,file_bytes,actor) returning * into f;
 insert into public.job_events(org_id,job_id,actor_id,event_type,revision,details) values(j.org_id,j.id,actor,'file_reserved:'||f.id::text,j.revision,jsonb_build_object('file_id',f.id,'bytes',file_bytes));
 return f;
end $$;
revoke all on function public.reserve_catalog_file(uuid,text,bigint,text) from public,anon;
grant execute on function public.reserve_catalog_file(uuid,text,bigint,text) to authenticated;

-- Source: 202611110006_service_workflow.sql
-- Immutable commercial decisions and communication. Browser clients only use RPCs.
create table public.catalog_scopes(
 id uuid primary key default gen_random_uuid(),org_id uuid not null,job_id uuid not null,version integer not null,
 description text not null check(length(description) between 1 and 12000),acceptance text not null check(length(acceptance) between 1 and 8000),
 exclusions text not null default '',price_cents bigint not null check(price_cents between 0 and 100000000),currency text not null check(currency='USD'),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 foreign key(org_id,job_id) references public.catalog_jobs(org_id,id),unique(job_id,version),unique(job_id,id)
);
create table public.scope_approvals(scope_id uuid primary key references public.catalog_scopes(id),approved_by uuid not null references auth.users(id),approved_at timestamptz not null default now());
create table public.catalog_payments(id uuid primary key default gen_random_uuid(),scope_id uuid not null references public.catalog_scopes(id),
 amount_cents bigint not null check(amount_cents between 0 and 100000000),reference text not null check(length(reference) between 1 and 500),
 recorded_by uuid not null references auth.users(id),created_at timestamptz not null default now(),unique(scope_id,reference));
create table public.catalog_questions(id uuid primary key default gen_random_uuid(),org_id uuid not null,job_id uuid not null,question text not null check(length(question) between 1 and 4000),
 context text not null default '' check(length(context)<=2000),asked_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 foreign key(org_id,job_id) references public.catalog_jobs(org_id,id));
create table public.catalog_answers(id uuid primary key default gen_random_uuid(),question_id uuid not null references public.catalog_questions(id),answer text not null check(length(answer) between 1 and 4000),answered_by uuid not null references auth.users(id),created_at timestamptz not null default now());
create table public.catalog_effort(id uuid primary key default gen_random_uuid(),job_id uuid not null references public.catalog_jobs(id),minutes integer not null check(minutes between 0 and 1440),cost_cents bigint not null check(cost_cents between 0 and 100000000),category text not null check(category in ('production','review','support','sourcing','correction','tools')),note text not null check(length(note) between 1 and 1000),recorded_by uuid not null references auth.users(id),created_at timestamptz not null default now());
alter table public.catalog_scopes enable row level security;
alter table public.scope_approvals enable row level security;
alter table public.catalog_payments enable row level security;
alter table public.catalog_questions enable row level security;
alter table public.catalog_answers enable row level security;
alter table public.catalog_effort enable row level security;
revoke all on public.catalog_scopes,public.scope_approvals,public.catalog_payments,public.catalog_questions,public.catalog_answers,public.catalog_effort from anon,authenticated;
grant select on public.catalog_scopes,public.scope_approvals,public.catalog_payments,public.catalog_questions,public.catalog_answers,public.catalog_effort to authenticated;
create policy scopes_read on public.catalog_scopes for select to authenticated using(public.catalog_role(org_id) is not null or public.catalog_staff_access(job_id));
create policy approvals_read on public.scope_approvals for select to authenticated using(exists(select 1 from public.catalog_scopes s where s.id=scope_id));
create policy payments_read on public.catalog_payments for select to authenticated using(exists(select 1 from public.catalog_scopes s where s.id=scope_id));
create policy questions_read on public.catalog_questions for select to authenticated using(public.catalog_role(org_id) is not null or public.catalog_staff_access(job_id));
create policy answers_read on public.catalog_answers for select to authenticated using(exists(select 1 from public.catalog_questions q where q.id=question_id));
create policy effort_read on public.catalog_effort for select to authenticated using(public.catalog_staff_access(job_id));
create policy staff_jobs_read on public.catalog_jobs for select to authenticated using(public.catalog_staff_access(id));
create policy staff_events_read on public.job_events for select to authenticated using(public.catalog_staff_access(job_id));
create function public.catalog_service_action(target_job uuid,command text,payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare j public.catalog_jobs; s public.catalog_scopes; actor uuid:=auth.uid(); result uuid; staff boolean; role_name text;
begin
 select * into j from public.catalog_jobs where id=target_job for update;
 if actor is null or j.id is null then raise exception 'Not available' using errcode='42501'; end if;
 staff:=public.catalog_staff_access(j.id);role_name:=public.catalog_role(j.org_id);
 if not staff and role_name is null then raise exception 'Not available' using errcode='42501'; end if;
 select * into s from public.catalog_scopes where job_id=j.id order by version desc limit 1;
 if command='quote' then
  if not staff or j.status not in ('submitted','scoping','awaiting_approval') then raise exception 'Quote not permitted' using errcode='42501'; end if;
  insert into public.catalog_scopes(org_id,job_id,version,description,acceptance,exclusions,price_cents,currency,created_by)
  values(j.org_id,j.id,coalesce(s.version,0)+1,payload->>'description',payload->>'acceptance',coalesce(payload->>'exclusions',''),(payload->>'price_cents')::bigint,'USD',actor) returning id into result;
  update public.catalog_jobs set status='awaiting_approval',revision=revision+1,updated_at=now() where id=j.id;
 elsif command='approve' then
  if role_name is distinct from 'owner' or j.status<>'awaiting_approval' or s.id is distinct from (payload->>'scope_id')::uuid or payload->>'approve_spend' is distinct from 'true' then raise exception 'Explicit owner approval of current quote required' using errcode='42501'; end if;
  insert into public.scope_approvals values(s.id,actor,now()) on conflict do nothing;result:=s.id;
 elsif command='payment' then
  if not staff or s.id is distinct from (payload->>'scope_id')::uuid then raise exception 'Payment record not permitted' using errcode='42501'; end if;
  insert into public.catalog_payments(scope_id,amount_cents,reference,recorded_by) values(s.id,(payload->>'amount_cents')::bigint,payload->>'reference',actor) on conflict(scope_id,reference) do nothing returning id into result;
 elsif command='start' then
  if not staff or j.status not in ('awaiting_approval','queued') or s.id is null or not exists(select 1 from public.scope_approvals where scope_id=s.id) then raise exception 'Approved scope required' using errcode='22023'; end if;
  if coalesce((select sum(amount_cents) from public.catalog_payments where scope_id=s.id),0)<s.price_cents then raise exception 'Payment required' using errcode='22023'; end if;
  if not exists(select 1 from public.source_files where job_id=j.id and state='ready') or exists(select 1 from public.source_files where job_id=j.id and state='quarantined') then raise exception 'Checked source files required' using errcode='22023'; end if;
  if exists(select 1 from public.catalog_questions q where q.job_id=j.id and not exists(select 1 from public.catalog_answers a where a.question_id=q.id)) then raise exception 'Customer answers required' using errcode='22023'; end if;
  update public.catalog_jobs set status='processing',revision=revision+1,updated_at=now() where id=j.id;result:=j.id;
 elsif command='question' then
  if not staff or j.status in ('accepted','closed','cancelled') then raise exception 'Question not permitted' using errcode='42501'; end if;
  insert into public.catalog_questions(org_id,job_id,question,context,asked_by) values(j.org_id,j.id,payload->>'question',coalesce(payload->>'context',''),actor) returning id into result;
 elsif command='answer' then
  if role_name is null or role_name='viewer' or not exists(select 1 from public.catalog_questions where id=(payload->>'question_id')::uuid and job_id=j.id) then raise exception 'Answer not permitted' using errcode='42501'; end if;
  insert into public.catalog_answers(question_id,answer,answered_by) values((payload->>'question_id')::uuid,payload->>'answer',actor) returning id into result;
 elsif command='effort' then
  if not staff then raise exception 'Effort not permitted' using errcode='42501'; end if;
  insert into public.catalog_effort(job_id,minutes,cost_cents,category,note,recorded_by) values(j.id,(payload->>'minutes')::integer,(payload->>'cost_cents')::bigint,payload->>'category',payload->>'note',actor) returning id into result;
 else raise exception 'Unsupported action' using errcode='22023';
 end if;
 if result is not null then insert into public.job_events(org_id,job_id,actor_id,event_type,revision,details) values(j.org_id,j.id,actor,command||':'||result::text,j.revision,jsonb_build_object('entity_id',result)) on conflict do nothing;end if;
 return result;
end $$;
revoke all on function public.catalog_service_action(uuid,text,jsonb) from public,anon;
grant execute on function public.catalog_service_action(uuid,text,jsonb) to authenticated;

-- Source: 202611110007_deliveries.sql
alter table public.source_files add column purpose text not null default 'source' check(purpose in ('source','delivery'));
create table public.catalog_deliveries(id uuid primary key default gen_random_uuid(),org_id uuid not null,job_id uuid not null,version integer not null,
 file_id uuid not null references public.source_files(id),notes text not null check(length(notes) between 1 and 8000),created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 foreign key(org_id,job_id) references public.catalog_jobs(org_id,id),unique(job_id,version));
create table public.delivery_decisions(id uuid primary key default gen_random_uuid(),delivery_id uuid not null references public.catalog_deliveries(id),decision text not null check(decision in ('released','accepted','correction')),note text not null check(length(note) between 1 and 4000),actor_id uuid not null references auth.users(id),created_at timestamptz not null default now());
create unique index one_release on public.delivery_decisions(delivery_id) where decision='released';
create unique index one_acceptance on public.delivery_decisions(delivery_id) where decision='accepted';
alter table public.catalog_deliveries enable row level security;alter table public.delivery_decisions enable row level security;
revoke all on public.catalog_deliveries,public.delivery_decisions from anon,authenticated;grant select on public.catalog_deliveries,public.delivery_decisions to authenticated;
create function public.catalog_delivery_released(target_delivery uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.delivery_decisions where delivery_id=target_delivery and decision='released') $$;
revoke all on function public.catalog_delivery_released(uuid) from public,anon;grant execute on function public.catalog_delivery_released(uuid) to authenticated;
create policy deliveries_read on public.catalog_deliveries for select to authenticated using(public.catalog_staff_access(job_id) or (public.catalog_role(org_id) is not null and public.catalog_delivery_released(id)));
create policy delivery_decisions_read on public.delivery_decisions for select to authenticated using(exists(select 1 from public.catalog_deliveries where id=delivery_id));
create function public.catalog_file_visible(target_file uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.source_files f where f.id=target_file and (public.catalog_staff_access(f.job_id) or (public.catalog_role(f.org_id) is not null and (f.purpose='source' or exists(select 1 from public.catalog_deliveries d where d.file_id=f.id and public.catalog_delivery_released(d.id))))))
$$;
revoke all on function public.catalog_file_visible(uuid) from public,anon;grant execute on function public.catalog_file_visible(uuid) to authenticated;
drop policy files_read on public.source_files;
create policy files_read on public.source_files for select to authenticated using(public.catalog_file_visible(id));
drop policy catalog_object_read on storage.objects;
create policy catalog_object_read on storage.objects for select to authenticated using(bucket_id='catalog-private' and exists(select 1 from public.source_files f where f.object_key=name and f.state='ready' and public.catalog_file_visible(f.id)));
create policy catalog_delivery_insert on storage.objects for insert to authenticated with check(bucket_id='catalog-private' and exists(select 1 from public.source_files f where f.object_key=name and f.purpose='delivery' and f.uploaded_by=auth.uid() and f.state='quarantined' and f.expires_at>now() and public.catalog_staff_access(f.job_id)));
create function public.reserve_catalog_delivery_file(target_job uuid,file_name text,file_bytes bigint,file_hash text) returns public.source_files language plpgsql security definer set search_path='' as $$
declare j public.catalog_jobs;f public.source_files;
begin
 select * into j from public.catalog_jobs where id=target_job for update;
 if j.id is null or not public.catalog_staff_access(j.id) or j.status not in ('processing','quality_review') then raise exception 'Delivery upload not available' using errcode='42501'; end if;
 if file_bytes not between 1 and 10485760 or file_hash !~ '^[a-f0-9]{64}$' or file_name !~* '^[^/\\[:cntrl:]]{1,180}\.(csv|xlsx|pdf)$' then raise exception 'Unsupported delivery file' using errcode='22023'; end if;
 if (select count(*) from public.source_files where job_id=j.id and purpose='delivery')>=20 then raise exception 'Delivery file limit reached' using errcode='22023';end if;
 insert into public.source_files(org_id,job_id,original_name,object_key,sha256,byte_size,uploaded_by,purpose) values(j.org_id,j.id,file_name,j.org_id::text||'/'||j.id::text||'/'||gen_random_uuid()::text,file_hash,file_bytes,auth.uid(),'delivery') returning * into f;
 return f;
end $$;
revoke all on function public.reserve_catalog_delivery_file(uuid,text,bigint,text) from public,anon;grant execute on function public.reserve_catalog_delivery_file(uuid,text,bigint,text) to authenticated;
create function public.catalog_delivery_action(target_job uuid,command text,payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare j public.catalog_jobs;d public.catalog_deliveries;actor uuid:=auth.uid();result uuid;
begin
 select * into j from public.catalog_jobs where id=target_job for update;
 if actor is null or j.id is null then raise exception 'Not available' using errcode='42501';end if;
 if command='prepare' then
  if not public.catalog_staff_access(j.id) or j.status not in ('processing','quality_review') then raise exception 'Not available' using errcode='42501';end if;
  if not exists(select 1 from public.source_files where id=(payload->>'file_id')::uuid and job_id=j.id and purpose='delivery' and state='ready') then raise exception 'Checked delivery file required' using errcode='22023';end if;
  insert into public.catalog_deliveries(org_id,job_id,version,file_id,notes,created_by) values(j.org_id,j.id,coalesce((select max(version) from public.catalog_deliveries where job_id=j.id),0)+1,(payload->>'file_id')::uuid,payload->>'notes',actor) returning id into result;
  update public.catalog_jobs set status='quality_review',revision=revision+1,updated_at=now() where id=j.id;
 else
  select * into d from public.catalog_deliveries where job_id=j.id order by version desc limit 1;
  if d.id is null or d.id is distinct from (payload->>'delivery_id')::uuid then raise exception 'Latest delivery required' using errcode='22023';end if;
  if command='release' then
   if not public.catalog_staff_access(j.id,true) or j.status<>'quality_review' or payload->>'review_complete' is distinct from 'true' then raise exception 'Assigned reviewer and explicit review required' using errcode='42501';end if;
   if not exists(select 1 from public.source_files where id=d.file_id and state='ready') then raise exception 'Checked file required' using errcode='22023';end if;
   insert into public.delivery_decisions(delivery_id,decision,note,actor_id) values(d.id,'released',payload->>'note',actor) returning id into result;
   update public.catalog_jobs set status='ready_for_review',revision=revision+1,updated_at=now() where id=j.id;
  elsif command in ('accept','correct') then
   if public.catalog_role(j.org_id) is null or public.catalog_role(j.org_id) not in ('owner','approver') or j.status<>'ready_for_review' or not public.catalog_delivery_released(d.id) then raise exception 'Customer approval not available' using errcode='42501';end if;
   insert into public.delivery_decisions(delivery_id,decision,note,actor_id) values(d.id,case when command='accept' then 'accepted' else 'correction' end,payload->>'note',actor) returning id into result;
   update public.catalog_jobs set status=case when command='accept' then 'accepted' else 'processing' end,revision=revision+1,updated_at=now() where id=j.id;
  else raise exception 'Unsupported delivery action' using errcode='22023';end if;
 end if;
 insert into public.job_events(org_id,job_id,actor_id,event_type,revision,details) values(j.org_id,j.id,actor,command||':'||result::text,j.revision,jsonb_build_object('entity_id',result));
 return result;
end $$;
revoke all on function public.catalog_delivery_action(uuid,text,jsonb) from public,anon;grant execute on function public.catalog_delivery_action(uuid,text,jsonb) to authenticated;

-- Source: 202611110008_notifications.sql
create table solvren_private.notification_outbox(
 id uuid primary key default gen_random_uuid(),event_id uuid not null references public.job_events(id),recipient_id uuid not null references auth.users(id),
 job_id uuid not null references public.catalog_jobs(id),subject text not null,body text not null,
 state text not null default 'pending' check(state in ('pending','sending','sent','failed','uncertain')),
 attempts integer not null default 0,next_attempt_at timestamptz not null default now(),started_at timestamptz,sent_at timestamptz,last_error text,
 unique(event_id,recipient_id)
);
revoke all on solvren_private.notification_outbox from public,anon,authenticated;
create function solvren_private.queue_job_notification() returns trigger language plpgsql security definer set search_path='' as $$
declare action text:=split_part(new.event_type,':',1);j public.catalog_jobs;recipient uuid;
begin
 if action not in ('submitted','quote','approve','question','answer','release','accept','correct') then return new;end if;
 select * into j from public.catalog_jobs where id=new.job_id;
 for recipient in
  select distinct candidate from (
   select j.created_by as candidate where action in ('quote','question','release')
   union select m.user_id from public.memberships m where m.org_id=j.org_id and m.role='owner' and action in ('quote','release')
   union select a.user_id from solvren_private.staff_assignments a join solvren_private.staff_members s on s.user_id=a.user_id and s.enabled where a.job_id=j.id and action in ('submitted','approve','answer','accept','correct')
  ) r where candidate<>new.actor_id
 loop
  insert into solvren_private.notification_outbox(event_id,recipient_id,job_id,subject,body)
  values(new.id,recipient,j.id,'Solvren: your catalog job has an update','There is an update to your catalog job. Sign in to your Solvren workspace to view it.') on conflict do nothing;
 end loop;
 return new;
end $$;
create trigger queue_job_notification after insert on public.job_events for each row execute function solvren_private.queue_job_notification();

-- Source: 202611110009_file_recovery.sql
-- Only unfinished files may be withdrawn; immutable delivered/source evidence is retained.
create function public.withdraw_catalog_file(target_file uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare f public.source_files; j public.catalog_jobs;
begin
 select * into f from public.source_files where id=target_file;
 select * into j from public.catalog_jobs where id=f.job_id for update;
 if auth.uid() is null or f.id is null or not coalesce((
 public.catalog_staff_access(j.id) or (public.catalog_role(j.org_id) in ('owner','admin','contributor') and f.uploaded_by=auth.uid())),false) then
 raise exception 'Not available' using errcode='42501'; end if;
 if f.state<>'quarantined' or exists(select 1 from public.catalog_deliveries where file_id=f.id) then raise exception 'Only unfinished uploads can be withdrawn' using errcode='22023';end if;
 update public.source_files set state='rejected',scan_reason='withdrawn',expires_at=now() where id=f.id and state='quarantined';
 if not found then raise exception 'File state changed' using errcode='22023';end if;
 insert into public.job_events(org_id,job_id,actor_id,event_type,revision,details) values(j.org_id,j.id,auth.uid(),'file_withdrawn:'||f.id,j.revision,jsonb_build_object('file_id',f.id));
 return true;
end $$;
revoke all on function public.withdraw_catalog_file(uuid) from public,anon;
grant execute on function public.withdraw_catalog_file(uuid) to authenticated;

create function public.audit_catalog_download(target_file uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare f public.source_files;
begin
 select * into f from public.source_files where id=target_file and state='ready';
 if auth.uid() is null or f.id is null or not public.catalog_file_visible(f.id) then raise exception 'Not available' using errcode='42501';end if;
 insert into public.job_events(org_id,job_id,actor_id,event_type,revision,details)
 select j.org_id,j.id,auth.uid(),'download_requested:'||gen_random_uuid(),j.revision,jsonb_build_object('file_id',f.id) from public.catalog_jobs j where j.id=f.job_id;
 return true;
end $$;
revoke all on function public.audit_catalog_download(uuid) from public,anon;
grant execute on function public.audit_catalog_download(uuid) to authenticated;

-- Source: 202611110010_delivery_engine.sql
create table public.catalog_runs(
 id uuid primary key,org_id uuid not null,job_id uuid not null,profile_version_id uuid not null,
 input_file_id uuid not null references public.source_files(id),baseline_file_id uuid references public.source_files(id),
 state text not null default 'queued' check(state in ('queued','running','blocked','review','failed')),
 checkpoint text not null default 'queued',attempts integer not null default 0,started_at timestamptz,completed_at timestamptz,
 result jsonb,diagnostic text,output_file_id uuid references public.source_files(id),created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 foreign key(org_id,job_id) references public.catalog_jobs(org_id,id),foreign key(org_id,profile_version_id) references public.catalog_profile_versions(org_id,id)
);
create table public.catalog_resolutions(
 id uuid primary key default gen_random_uuid(),run_id uuid not null references public.catalog_runs(id),row_number integer not null check(row_number between 2 and 2001),field text not null,
 proposed text not null check(length(proposed)<=4000),evidence_file_id uuid not null references public.source_files(id),locator text not null check(length(locator) between 1 and 300),
 reason text not null check(length(reason) between 1 and 2000),actor_id uuid not null references auth.users(id),created_at timestamptz not null default now(),unique(run_id,row_number,field)
);
create table public.catalog_run_reviews(run_id uuid primary key references public.catalog_runs(id),reviewer uuid not null references auth.users(id),note text not null check(length(note) between 1 and 4000),created_at timestamptz not null default now());
alter table public.catalog_runs enable row level security;alter table public.catalog_resolutions enable row level security;alter table public.catalog_run_reviews enable row level security;
revoke all on public.catalog_runs,public.catalog_resolutions,public.catalog_run_reviews from anon,authenticated;
grant select on public.catalog_runs,public.catalog_resolutions,public.catalog_run_reviews to authenticated;
create policy runs_read on public.catalog_runs for select to authenticated using(public.catalog_staff_access(job_id));
create policy resolutions_read on public.catalog_resolutions for select to authenticated using(exists(select 1 from public.catalog_runs r where r.id=run_id));
create policy run_reviews_read on public.catalog_run_reviews for select to authenticated using(exists(select 1 from public.catalog_runs r where r.id=run_id));
create policy staff_profile_read on public.catalog_profile_versions for select to authenticated using(exists(select 1 from public.catalog_jobs j where j.org_id=catalog_profile_versions.org_id and public.catalog_staff_access(j.id)));
create table solvren_private.catalog_capacity(user_id uuid primary key references solvren_private.staff_members(user_id),weekly_minutes integer not null check(weekly_minutes between 0 and 10080));
alter table public.catalog_jobs add column planned_minutes integer not null default 0 check(planned_minutes between 0 and 100000);

create function public.catalog_engine_action(target_job uuid,command text,payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare j public.catalog_jobs;r public.catalog_runs;p public.catalog_profile_versions;result uuid;definition jsonb;f jsonb;
begin
 select * into j from public.catalog_jobs where id=target_job for update;
 if j.id is null or not public.catalog_staff_access(j.id) then raise exception 'Assigned MFA operator required' using errcode='42501';end if;
 if command='profile' then
  if j.status not in ('draft','submitted','scoping','awaiting_approval') or exists(select 1 from public.catalog_scopes s join public.scope_approvals a on a.scope_id=s.id where s.job_id=j.id) then raise exception 'Profile must be pinned before scope approval' using errcode='22023';end if;
  definition:=payload->'definition';
  if jsonb_typeof(definition->'fields') is distinct from 'array' or jsonb_array_length(definition->'fields') not between 1 and 40 or length(definition->>'name') not between 1 and 120 then raise exception 'Invalid profile' using errcode='22023';end if;
  for f in select * from jsonb_array_elements(definition->'fields') loop
   if length(f->>'source') not between 1 and 80 or length(f->>'target') not between 1 and 80 or f->>'transform' not in ('none','trim') then raise exception 'Invalid mapping' using errcode='22023';end if;
  end loop;
  insert into public.catalog_profile_versions(org_id,name,version,schema_definition) values(j.org_id,definition->>'name',coalesce((select max(version) from public.catalog_profile_versions where org_id=j.org_id and name=definition->>'name'),0)+1,definition) returning * into p;
  update public.catalog_jobs set profile_version_id=p.id,revision=revision+1 where id=j.id;result:=p.id;
 elsif command='queue' then
  if j.status not in ('processing','quality_review') or j.profile_version_id is null then raise exception 'Approved processing job with pinned profile required' using errcode='22023';end if;
  if exists(select 1 from public.catalog_runs where job_id=j.id and state in ('queued','running')) then raise exception 'Run already active' using errcode='22023';end if;
  if not exists(select 1 from public.source_files where id=(payload->>'input_file_id')::uuid and job_id=j.id and purpose='source' and state='ready') then raise exception 'Checked source required' using errcode='22023';end if;
  if payload->>'baseline_file_id' is not null and not exists(select 1 from public.source_files where id=(payload->>'baseline_file_id')::uuid and job_id=j.id and purpose='source' and state='ready') then raise exception 'Checked baseline required' using errcode='22023';end if;
  result:=(payload->>'request_id')::uuid;
  if exists(select 1 from public.catalog_runs where id=result and job_id<>j.id) then raise exception 'Invalid request' using errcode='42501';end if;
  insert into public.catalog_runs(id,org_id,job_id,profile_version_id,input_file_id,baseline_file_id,created_by) values(result,j.org_id,j.id,j.profile_version_id,(payload->>'input_file_id')::uuid,(payload->>'baseline_file_id')::uuid,auth.uid()) on conflict(id) do nothing;
 elsif command in ('resolve','retry','review') then
  select * into r from public.catalog_runs where id=(payload->>'run_id')::uuid and job_id=j.id for update;
  if r.id is null or exists(select 1 from public.catalog_runs where job_id=j.id and created_at>r.created_at) then raise exception 'Latest run required' using errcode='22023';end if;
  if command='resolve' then
   if r.state<>'blocked' or exists(select 1 from public.catalog_run_reviews where run_id=r.id) then raise exception 'Blocked unreviewed run required' using errcode='22023';end if;
   if not exists(select 1 from jsonb_array_elements(r.result->'issues') issue where (issue->>'row')::int=(payload->>'row')::int and issue->>'field'=payload->>'field') then raise exception 'Existing exception required' using errcode='22023';end if;
   if (select schema_definition->>'identifier' from public.catalog_profile_versions where id=r.profile_version_id)=payload->>'field' then raise exception 'Identifier corrections require a newly scoped source, not an override' using errcode='22023';end if;
   if not exists(select 1 from public.source_files where id=(payload->>'evidence_file_id')::uuid and job_id=j.id and state='ready' and purpose='source') then raise exception 'Checked evidence required' using errcode='22023';end if;
   insert into public.catalog_resolutions(run_id,row_number,field,proposed,evidence_file_id,locator,reason,actor_id) values(r.id,(payload->>'row')::int,payload->>'field',payload->>'proposed',(payload->>'evidence_file_id')::uuid,payload->>'locator',payload->>'reason',auth.uid()) returning id into result;
  elsif command='retry' then
   if r.state not in ('failed','blocked') or r.attempts>=3 or exists(select 1 from public.catalog_run_reviews where run_id=r.id) then raise exception 'Retry unavailable; inspect or create a new run' using errcode='22023';end if;
   update public.catalog_runs set state='queued',diagnostic=null,started_at=null,checkpoint=case when state='blocked' then 'queued' else checkpoint end,result=case when state='blocked' then null else result end where id=r.id;result:=r.id;
  else
   if not public.catalog_staff_access(j.id,true) or r.state<>'review' or r.output_file_id is null or jsonb_array_length(r.result->'issues')<>0 or payload->>'review_complete' is distinct from 'true' then raise exception 'Clean completed run and full reviewer confirmation required' using errcode='42501';end if;
   insert into public.catalog_run_reviews(run_id,reviewer,note) values(r.id,auth.uid(),payload->>'note') on conflict do nothing;result:=r.id;
  end if;
 elsif command='capacity' then
  update public.catalog_jobs set planned_minutes=(payload->>'minutes')::integer where id=j.id;result:=j.id;
 else raise exception 'Unsupported engine action' using errcode='22023';end if;
 insert into public.job_events(org_id,job_id,actor_id,event_type,revision,details) values(j.org_id,j.id,auth.uid(),'engine_'||command||':'||gen_random_uuid(),j.revision,jsonb_build_object('entity_id',result));
 return result;
end $$;
revoke all on function public.catalog_engine_action(uuid,text,jsonb) from public,anon;grant execute on function public.catalog_engine_action(uuid,text,jsonb) to authenticated;

create function solvren_private.check_engine_release() returns trigger language plpgsql set search_path='' as $$
declare d public.catalog_deliveries;r public.catalog_runs;
begin
 if new.decision<>'released' then return new;end if;
 select * into d from public.catalog_deliveries where id=new.delivery_id;
 select * into r from public.catalog_runs where job_id=d.job_id order by created_at desc limit 1;
 if r.id is not null and (r.state<>'review' or r.output_file_id is distinct from d.file_id or coalesce(jsonb_array_length(r.result->'issues'),1)<>0 or not exists(select 1 from public.catalog_run_reviews where run_id=r.id)) then raise exception 'Engine QA gate blocks release' using errcode='22023';end if;
 return new;
end $$;
create trigger engine_release_gate before insert on public.delivery_decisions for each row execute function solvren_private.check_engine_release();

create function public.reorder_catalog_job(target_job uuid,request_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare j public.catalog_jobs;
begin
 select * into j from public.catalog_jobs where id=target_job;
 if auth.uid() is null or coalesce(public.catalog_role(j.org_id),'') not in ('owner','admin','contributor') or j.status not in ('accepted','closed') then raise exception 'Reorder unavailable' using errcode='42501';end if;
 if exists(select 1 from public.catalog_jobs where id=request_id) then raise exception 'Request already exists' using errcode='22023';end if;
 insert into public.catalog_jobs(id,org_id,title,outcome,target_template,created_by,profile_version_id) values(request_id,j.org_id,left(j.title||' — reorder',120),j.outcome,j.target_template,auth.uid(),j.profile_version_id);
 insert into public.job_events(org_id,job_id,actor_id,event_type,revision,details) values(j.org_id,request_id,auth.uid(),'reordered:'||target_job,0,jsonb_build_object('previous_job',target_job,'profile',j.profile_version_id));
 return request_id;
end $$;
revoke all on function public.reorder_catalog_job(uuid,uuid) from public,anon;grant execute on function public.reorder_catalog_job(uuid,uuid) to authenticated;

-- Source: 202611110011_capacity.sql
create function public.catalog_workload() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('weekly_minutes',coalesce((select weekly_minutes from solvren_private.catalog_capacity where user_id=auth.uid()),0),'jobs',coalesce((
 select jsonb_agg(jsonb_build_object('id',j.id,'title',j.title,'status',j.status,'planned_minutes',j.planned_minutes,'logged_minutes',coalesce((select sum(minutes) from public.catalog_effort where job_id=j.id),0)))
 from public.catalog_jobs j where public.catalog_staff_access(j.id) and j.status not in ('accepted','closed','cancelled')),'[]'::jsonb))
$$;
revoke all on function public.catalog_workload() from public,anon;grant execute on function public.catalog_workload() to authenticated;
create function public.plan_catalog_capacity(target_job uuid,job_minutes integer,available_minutes integer) returns boolean language plpgsql security definer set search_path='' as $$
declare j public.catalog_jobs;
begin
 select * into j from public.catalog_jobs where id=target_job for update;
 if j.id is null or not public.catalog_staff_access(j.id) then raise exception 'Assigned operator required' using errcode='42501';end if;
 update public.catalog_jobs set planned_minutes=job_minutes where id=j.id;
 insert into solvren_private.catalog_capacity(user_id,weekly_minutes) values(auth.uid(),available_minutes) on conflict(user_id) do update set weekly_minutes=excluded.weekly_minutes;
 insert into public.job_events(org_id,job_id,actor_id,event_type,revision,details) values(j.org_id,j.id,auth.uid(),'capacity_planned:'||gen_random_uuid(),j.revision,jsonb_build_object('job_minutes',job_minutes,'weekly_minutes',available_minutes));
 return true;
end $$;
revoke all on function public.plan_catalog_capacity(uuid,integer,integer) from public,anon;grant execute on function public.plan_catalog_capacity(uuid,integer,integer) to authenticated;

-- Source: 202611110012_engine_rpc_fix.sql
-- Avoid ambiguity between the local response identifier and catalog_runs.result.
create or replace function public.catalog_engine_action(target_job uuid,command text,payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare j public.catalog_jobs;r public.catalog_runs;p public.catalog_profile_versions;response_id uuid;definition jsonb;f jsonb;
begin
 select * into j from public.catalog_jobs where id=target_job for update;
 if j.id is null or not public.catalog_staff_access(j.id) then raise exception 'Assigned MFA operator required' using errcode='42501';end if;
 if command='profile' then
  if j.status not in ('draft','submitted','scoping','awaiting_approval') or exists(select 1 from public.catalog_scopes s join public.scope_approvals a on a.scope_id=s.id where s.job_id=j.id) then raise exception 'Profile must be pinned before scope approval' using errcode='22023';end if;
  definition:=payload->'definition';
  if jsonb_typeof(definition->'fields') is distinct from 'array' or jsonb_array_length(definition->'fields') not between 1 and 40 or length(definition->>'name') not between 1 and 120 then raise exception 'Invalid profile' using errcode='22023';end if;
  for f in select * from jsonb_array_elements(definition->'fields') loop
   if length(f->>'source') not between 1 and 80 or length(f->>'target') not between 1 and 80 or f->>'transform' not in ('none','trim') then raise exception 'Invalid mapping' using errcode='22023';end if;
  end loop;
  insert into public.catalog_profile_versions(org_id,name,version,schema_definition) values(j.org_id,definition->>'name',coalesce((select max(version) from public.catalog_profile_versions where org_id=j.org_id and name=definition->>'name'),0)+1,definition) returning * into p;
  update public.catalog_jobs set profile_version_id=p.id,revision=revision+1 where id=j.id;response_id:=p.id;
 elsif command='queue' then
  if j.status not in ('processing','quality_review') or j.profile_version_id is null then raise exception 'Approved processing job with pinned profile required' using errcode='22023';end if;
  if exists(select 1 from public.catalog_runs where job_id=j.id and state in ('queued','running')) then raise exception 'Run already active' using errcode='22023';end if;
  if not exists(select 1 from public.source_files where id=(payload->>'input_file_id')::uuid and job_id=j.id and purpose='source' and state='ready') then raise exception 'Checked source required' using errcode='22023';end if;
  if payload->>'baseline_file_id' is not null and not exists(select 1 from public.source_files where id=(payload->>'baseline_file_id')::uuid and job_id=j.id and purpose='source' and state='ready') then raise exception 'Checked baseline required' using errcode='22023';end if;
  response_id:=(payload->>'request_id')::uuid;
  if exists(select 1 from public.catalog_runs where id=response_id and job_id<>j.id) then raise exception 'Invalid request' using errcode='42501';end if;
  insert into public.catalog_runs(id,org_id,job_id,profile_version_id,input_file_id,baseline_file_id,created_by) values(response_id,j.org_id,j.id,j.profile_version_id,(payload->>'input_file_id')::uuid,(payload->>'baseline_file_id')::uuid,auth.uid()) on conflict(id) do nothing;
 elsif command in ('resolve','retry','review') then
  select * into r from public.catalog_runs where id=(payload->>'run_id')::uuid and job_id=j.id for update;
  if r.id is null or exists(select 1 from public.catalog_runs where job_id=j.id and created_at>r.created_at) then raise exception 'Latest run required' using errcode='22023';end if;
  if command='resolve' then
   if r.state<>'blocked' or exists(select 1 from public.catalog_run_reviews where run_id=r.id) then raise exception 'Blocked unreviewed run required' using errcode='22023';end if;
   if not exists(select 1 from jsonb_array_elements(r.result->'issues') issue where (issue->>'row')::int=(payload->>'row')::int and issue->>'field'=payload->>'field') then raise exception 'Existing exception required' using errcode='22023';end if;
   if (select schema_definition->>'identifier' from public.catalog_profile_versions where id=r.profile_version_id)=payload->>'field' then raise exception 'Identifier corrections require a newly scoped source, not an override' using errcode='22023';end if;
   if not exists(select 1 from public.source_files where id=(payload->>'evidence_file_id')::uuid and job_id=j.id and state='ready' and purpose='source') then raise exception 'Checked evidence required' using errcode='22023';end if;
   insert into public.catalog_resolutions(run_id,row_number,field,proposed,evidence_file_id,locator,reason,actor_id) values(r.id,(payload->>'row')::int,payload->>'field',payload->>'proposed',(payload->>'evidence_file_id')::uuid,payload->>'locator',payload->>'reason',auth.uid()) returning id into response_id;
  elsif command='retry' then
   if r.state not in ('failed','blocked') or r.attempts>=3 or exists(select 1 from public.catalog_run_reviews where run_id=r.id) then raise exception 'Retry unavailable; inspect or create a new run' using errcode='22023';end if;
   update public.catalog_runs set state='queued',diagnostic=null,started_at=null,checkpoint=case when state='blocked' then 'queued' else checkpoint end,result=case when state='blocked' then null else result end where id=r.id;response_id:=r.id;
  else
   if not public.catalog_staff_access(j.id,true) or r.state<>'review' or r.output_file_id is null or jsonb_array_length(r.result->'issues')<>0 or payload->>'review_complete' is distinct from 'true' then raise exception 'Clean completed run and full reviewer confirmation required' using errcode='42501';end if;
   insert into public.catalog_run_reviews(run_id,reviewer,note) values(r.id,auth.uid(),payload->>'note') on conflict do nothing;response_id:=r.id;
  end if;
 elsif command='capacity' then
  update public.catalog_jobs set planned_minutes=(payload->>'minutes')::integer where id=j.id;response_id:=j.id;
 else raise exception 'Unsupported engine action' using errcode='22023';end if;
 insert into public.job_events(org_id,job_id,actor_id,event_type,revision,details) values(j.org_id,j.id,auth.uid(),'engine_'||command||':'||gen_random_uuid(),j.revision,jsonb_build_object('entity_id',response_id));
 return response_id;
end $$;
revoke all on function public.catalog_engine_action(uuid,text,jsonb) from public,anon;grant execute on function public.catalog_engine_action(uuid,text,jsonb) to authenticated;


-- Source: 202611110013_job_holds.sql
alter table public.catalog_jobs add column hold_reason text;
alter table public.catalog_jobs add column resume_status text;
create function public.catalog_lifecycle_action(target_job uuid,command text,note text) returns boolean language plpgsql security definer set search_path='' as $$
declare j public.catalog_jobs;staff boolean;
begin
 select * into j from public.catalog_jobs where id=target_job for update;
 staff:=public.catalog_staff_access(j.id);
 if j.id is null or auth.uid() is null or not (staff or coalesce(public.catalog_role(j.org_id),'')='owner') then raise exception 'Not available' using errcode='42501';end if;
 if length(trim(note)) not between 1 and 2000 then raise exception 'Reason required' using errcode='22023';end if;
 if command='pause' then
  if not staff or j.status not in ('processing','quality_review') then raise exception 'Only active assigned work can be paused' using errcode='22023';end if;
  update public.catalog_jobs set resume_status=status,status='awaiting_customer',hold_reason=note,revision=revision+1,updated_at=now() where id=j.id;
 elsif command='resume' then
  if not staff or j.status<>'awaiting_customer' or j.resume_status not in ('processing','quality_review') then raise exception 'No paused work to resume' using errcode='22023';end if;
  update public.catalog_jobs set status=resume_status,resume_status=null,hold_reason=null,revision=revision+1,updated_at=now() where id=j.id;
 elsif command='cancel' then
  if j.status not in ('draft','submitted','scoping','awaiting_approval') then raise exception 'Active or paid work requires an operator cancellation and payment reconciliation outside this initial flow' using errcode='22023';end if;
  if exists(select 1 from public.catalog_payments p join public.catalog_scopes s on s.id=p.scope_id where s.job_id=j.id and p.amount_cents>0) then raise exception 'Reconcile recorded payments before cancellation' using errcode='22023';end if;
  update public.catalog_jobs set status='cancelled',hold_reason=note,revision=revision+1,updated_at=now() where id=j.id;
 elsif command='close' then
  if j.status<>'accepted' then raise exception 'Explicit customer acceptance required before closure' using errcode='22023';end if;
  update public.catalog_jobs set status='closed',revision=revision+1,updated_at=now() where id=j.id;
 else raise exception 'Unsupported state action' using errcode='22023';end if;
 insert into public.job_events(org_id,job_id,actor_id,event_type,revision,details) values(j.org_id,j.id,auth.uid(),'lifecycle_'||command||':'||gen_random_uuid(),j.revision,jsonb_build_object('reason',note));
 return true;
end $$;
revoke all on function public.catalog_lifecycle_action(uuid,text,text) from public,anon;grant execute on function public.catalog_lifecycle_action(uuid,text,text) to authenticated;

-- Source: 202611110014_upload_resume.sql
create function public.catalog_upload_received(target_file uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.source_files f join storage.objects o on o.bucket_id='catalog-private' and o.name=f.object_key where f.id=target_file and f.uploaded_by=auth.uid() and public.catalog_file_visible(f.id))
$$;
revoke all on function public.catalog_upload_received(uuid) from public,anon;grant execute on function public.catalog_upload_received(uuid) to authenticated;

-- Source: 202611110015_system_audit.sql
-- Privileged maintenance events are explicitly system-originated, not attributed
-- to a human who did not click an application action. Browser inserts stay revoked.
alter table public.job_events alter column actor_id drop not null;

-- Source: 202611110016_quote_binding.sql
alter table public.catalog_scopes add column profile_version_id uuid references public.catalog_profile_versions(id);
create function solvren_private.bind_scope_profile() returns trigger language plpgsql set search_path='' as $$
begin
 select profile_version_id into new.profile_version_id from public.catalog_jobs where id=new.job_id;
 return new;
end $$;
create trigger bind_scope_profile before insert on public.catalog_scopes for each row execute function solvren_private.bind_scope_profile();
create function solvren_private.invalidate_quote_on_profile_change() returns trigger language plpgsql set search_path='' as $$
begin
 if new.profile_version_id is distinct from old.profile_version_id then
  if exists(select 1 from public.catalog_scopes s join public.scope_approvals a on a.scope_id=s.id where s.job_id=old.id) then raise exception 'Approved profile cannot change' using errcode='22023';end if;
  if old.status='awaiting_approval' then new.status:='scoping';end if;
 end if;
 return new;
end $$;
create trigger protect_job_profile before update of profile_version_id on public.catalog_jobs for each row execute function solvren_private.invalidate_quote_on_profile_change();
create function solvren_private.check_scope_profile_approval() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.catalog_scopes s join public.catalog_jobs j on j.id=s.job_id where s.id=new.scope_id and s.profile_version_id is distinct from j.profile_version_id) then raise exception 'Quote must be reissued for the current profile' using errcode='22023';end if;
 return new;
end $$;
create trigger check_scope_profile_approval before insert on public.scope_approvals for each row execute function solvren_private.check_scope_profile_approval();
create function solvren_private.check_payment_replay() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.catalog_payments where scope_id=new.scope_id and reference=new.reference and amount_cents<>new.amount_cents) then raise exception 'Existing payment reference has a different amount' using errcode='22023';end if;
 return new;
end $$;
create trigger check_payment_replay before insert on public.catalog_payments for each row execute function solvren_private.check_payment_replay();

-- Source: 202611110017_delivery_visibility.sql
-- A callable policy helper must not disclose another tenant's delivery state.
create or replace function public.catalog_delivery_released(target_delivery uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.delivery_decisions x join public.catalog_deliveries d on d.id=x.delivery_id
 where d.id=target_delivery and x.decision='released' and (public.catalog_role(d.org_id) is not null or public.catalog_staff_access(d.job_id)))
$$;

-- Source: 202611110018_teams.sql
-- Invitations are email-bound, expiring and one-use. Only hashes are persisted.
create table solvren_private.team_invitations (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id),
 email text not null, role text not null check(role in ('admin','contributor','approver','viewer')),
 token_hash bytea not null unique, created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '7 days',
 accepted_at timestamptz, revoked_at timestamptz
);
create table public.organization_events (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id),
 actor_id uuid not null references auth.users(id), event_type text not null, details jsonb not null default '{}', created_at timestamptz not null default now()
);
alter table public.organization_events enable row level security;
revoke all on public.organization_events from anon,authenticated;
grant select on public.organization_events to authenticated;
create policy organization_events_read on public.organization_events for select to authenticated using(public.catalog_role(org_id) in ('owner','admin'));
create function public.catalog_team_read(workspace uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if public.catalog_role(workspace) not in ('owner','admin') or public.catalog_role(workspace) is null then raise exception 'Not available' using errcode='42501'; end if;
 return jsonb_build_object('members',(select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'email',u.email,'role',m.role) order by m.created_at),'[]'::jsonb) from public.memberships m join auth.users u on u.id=m.user_id where m.org_id=workspace),'invitations',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'email',i.email,'role',i.role,'expires_at',i.expires_at,'accepted_at',i.accepted_at,'revoked_at',i.revoked_at) order by i.created_at desc),'[]'::jsonb) from solvren_private.team_invitations i where i.org_id=workspace));
end $$;
create function public.catalog_team_action(workspace uuid,command text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); actor_role text; recipient uuid; old_role text; requested_role text; email_address text; token text; invitation solvren_private.team_invitations; output jsonb:='{}';
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then raise exception 'Verified account required' using errcode='42501'; end if;
 if command='accept' then
  select * into invitation from solvren_private.team_invitations where token_hash=sha256(convert_to(payload->>'token','UTF8'));
  if invitation.id is null or invitation.revoked_at is not null or invitation.accepted_at is not null or invitation.expires_at<=now() or invitation.email<>(select lower(email) from auth.users where id=actor) then raise exception 'Invitation unavailable' using errcode='42501'; end if;
  -- Serialize with team mutations, including ownership transfer.
  perform 1 from public.organizations where id=invitation.org_id for update;
  select * into invitation from solvren_private.team_invitations where id=invitation.id for update;
  if invitation.revoked_at is not null or invitation.accepted_at is not null or invitation.expires_at<=now() then raise exception 'Invitation unavailable' using errcode='42501'; end if;
  insert into public.memberships(org_id,user_id,role) values(invitation.org_id,actor,invitation.role) on conflict do nothing;
  update solvren_private.team_invitations set accepted_at=now() where id=invitation.id;
  insert into public.organization_events(org_id,actor_id,event_type) values(invitation.org_id,actor,'invitation_accepted');
  return jsonb_build_object('orgId',invitation.org_id);
 end if;
 perform 1 from public.organizations where id=workspace for update;
 actor_role:=public.catalog_role(workspace);
 if actor_role is null or actor_role not in ('owner','admin') then raise exception 'Not available' using errcode='42501'; end if;
 if command in ('invite','resend') then
  if command='resend' then
   select * into invitation from solvren_private.team_invitations where id=(payload->>'id')::uuid and org_id=workspace and accepted_at is null and revoked_at is null;
   if invitation.id is null then raise exception 'Invitation unavailable' using errcode='22023'; end if;
   email_address:=invitation.email; requested_role:=invitation.role;
  else email_address:=lower(trim(payload->>'email')); requested_role:=payload->>'role'; end if;
  if email_address is null or length(email_address)>254 or email_address !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or requested_role is null or requested_role not in ('admin','contributor','approver','viewer') or (actor_role='admin' and requested_role='admin') then raise exception 'Invalid invitation' using errcode='22023'; end if;
  if exists(select 1 from public.memberships m join auth.users u on u.id=m.user_id where m.org_id=workspace and lower(u.email)=email_address) then raise exception 'Already a member' using errcode='22023'; end if;
  if (select count(*) from solvren_private.team_invitations where org_id=workspace and created_at>now()-interval '1 hour')>=20 then raise exception 'Invitation limit reached' using errcode='22023'; end if;
  update solvren_private.team_invitations set revoked_at=now() where org_id=workspace and email=email_address and accepted_at is null and revoked_at is null;
  token:=gen_random_uuid()::text||gen_random_uuid()::text;
  insert into solvren_private.team_invitations(org_id,email,role,token_hash,created_by) values(workspace,email_address,requested_role,sha256(convert_to(token,'UTF8')),actor);
  output:=jsonb_build_object('token',token);
 elsif command='revoke' then
  update solvren_private.team_invitations set revoked_at=now() where id=(payload->>'id')::uuid and org_id=workspace and accepted_at is null and revoked_at is null and (actor_role='owner' or role<>'admin');
  if not found then raise exception 'Invitation unavailable' using errcode='42501'; end if;
 elsif command in ('role','remove','transfer') then
  recipient:=(payload->>'userId')::uuid;
  select role into old_role from public.memberships where org_id=workspace and user_id=recipient;
  if old_role is null or recipient=actor or old_role='owner' or (actor_role='admin' and old_role='admin') then raise exception 'Member unavailable' using errcode='42501'; end if;
  if command='remove' then delete from public.memberships where org_id=workspace and user_id=recipient;
  elsif command='transfer' then
   if actor_role<>'owner' or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'Owner MFA required' using errcode='42501'; end if;
   update public.memberships set role='owner' where org_id=workspace and user_id=recipient;
   update public.memberships set role='admin' where org_id=workspace and user_id=actor;
  else
   requested_role:=payload->>'role';
   if requested_role is null or requested_role not in ('admin','contributor','approver','viewer') or (actor_role='admin' and requested_role='admin') then raise exception 'Invalid role' using errcode='42501'; end if;
   update public.memberships set role=requested_role where org_id=workspace and user_id=recipient;
  end if;
 else raise exception 'Unknown action' using errcode='22023'; end if;
 insert into public.organization_events(org_id,actor_id,event_type,details) values(workspace,actor,'team_'||command,jsonb_build_object('userId',recipient,'role',requested_role));
 return output;
end $$;
revoke all on function public.catalog_team_read(uuid),public.catalog_team_action(uuid,text,jsonb) from public,anon;
grant execute on function public.catalog_team_read(uuid),public.catalog_team_action(uuid,text,jsonb) to authenticated;

-- Source: 202611110019_service_desk.sql
-- General intake/support access is explicit, separate from per-job delivery permission.
create function public.catalog_desk_access() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(auth.jwt()->>'aal'='aal2',false) and exists(select 1 from solvren_private.staff_members s join auth.users u on u.id=s.user_id and u.email_confirmed_at is not null join solvren_private.operator_allowlist a on a.email=lower(u.email) and a.enabled where s.user_id=auth.uid() and s.enabled)
$$;
revoke all on function public.catalog_desk_access() from public,anon;
grant execute on function public.catalog_desk_access() to authenticated;
create table public.service_cases(
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id),created_by uuid not null references auth.users(id),
 kind text not null check(kind in ('pilot','support','privacy','capacity_change','refund')),
 subject text not null check(length(trim(subject)) between 1 and 160),
 details text not null check(length(trim(details)) between 1 and 6000), qualification jsonb not null default '{}',
 status text not null default 'open' check(status in ('open','awaiting_customer','resolved','declined')),
 assigned_to uuid references solvren_private.staff_members(user_id),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.service_case_messages(
 id uuid primary key default gen_random_uuid(),case_id uuid not null references public.service_cases(id),actor_id uuid not null references auth.users(id),
 body text not null check(length(trim(body)) between 1 and 6000),created_at timestamptz not null default now()
);
alter table public.service_cases enable row level security;
alter table public.service_case_messages enable row level security;
revoke all on public.service_cases,public.service_case_messages from anon,authenticated;
grant select on public.service_cases,public.service_case_messages to authenticated;
create policy cases_read on public.service_cases for select to authenticated using(public.catalog_role(org_id) in ('owner','admin') or (created_by=auth.uid() and public.catalog_role(org_id) is not null) or public.catalog_desk_access());
create policy messages_read on public.service_case_messages for select to authenticated using(exists(select 1 from public.service_cases c where c.id=case_id));
create function public.catalog_case_action(workspace uuid,command text,payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); c public.service_cases; output uuid; member_role text; staff boolean:=public.catalog_desk_access(); q jsonb;
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then raise exception 'Verified account required' using errcode='42501'; end if;
 if command='create' then
  member_role:=public.catalog_role(workspace);
  if member_role is null then raise exception 'Unavailable' using errcode='42501'; end if;
  if (payload->>'kind') in ('pilot','capacity_change','refund') and member_role not in ('owner','admin') then raise exception 'Owner or admin required' using errcode='42501'; end if;
  if (select count(*) from public.service_cases where created_by=actor and created_at>now()-interval '1 hour')>=10 then raise exception 'Case limit reached' using errcode='22023'; end if;
  q:=coalesce(payload->'qualification','{}');
  if payload->>'kind'='pilot' and ((q->>'records') is null or (q->>'records')::int not between 1 and 1000000 or coalesce(q->>'format','') not in ('csv','xlsx','other') or coalesce(q->>'frequency','') not in ('one_time','monthly','weekly','other') or q->>'authorized' is distinct from 'true' or length(coalesce(q->>'destination','')) not between 1 and 1000) then raise exception 'Complete qualification required' using errcode='22023'; end if;
  insert into public.service_cases(org_id,created_by,kind,subject,details,qualification) values(workspace,actor,payload->>'kind',payload->>'subject',payload->>'details',q) returning id into output;
 else
  select * into c from public.service_cases where id=(payload->>'id')::uuid for update;
  member_role:=public.catalog_role(c.org_id);
  if c.id is null or (not staff and not coalesce(member_role in ('owner','admin') or (member_role is not null and c.created_by=actor),false)) then raise exception 'Unavailable' using errcode='42501'; end if;
  if command='claim' then
   if not staff or (c.assigned_to is not null and c.assigned_to<>actor) then raise exception 'Already assigned or unavailable' using errcode='42501'; end if;
   update public.service_cases set assigned_to=actor,updated_at=now() where id=c.id;
  elsif command='reply' then
   if staff and c.assigned_to is distinct from actor and member_role is null then raise exception 'Claim case first' using errcode='42501'; end if;
   insert into public.service_case_messages(case_id,actor_id,body) values(c.id,actor,payload->>'body');
   update public.service_cases set status=case when staff and c.assigned_to=actor then 'awaiting_customer' else 'open' end,updated_at=now() where id=c.id;
  elsif command='status' then
   if not staff or c.assigned_to is distinct from actor or payload->>'status' not in ('open','awaiting_customer','resolved','declined') then raise exception 'Assigned staff required' using errcode='42501'; end if;
   insert into public.service_case_messages(case_id,actor_id,body) values(c.id,actor,payload->>'body');
   update public.service_cases set status=payload->>'status',updated_at=now() where id=c.id;
  else raise exception 'Unknown action' using errcode='22023'; end if;
  output:=c.id;workspace:=c.org_id;
 end if;
 insert into public.organization_events(org_id,actor_id,event_type,details) values(workspace,actor,'case_'||command,jsonb_build_object('caseId',output));
 return output;
end $$;
revoke all on function public.catalog_case_action(uuid,text,jsonb) from public,anon;
grant execute on function public.catalog_case_action(uuid,text,jsonb) to authenticated;

-- Source: 202611110020_billing.sql
alter table public.catalog_payments alter column recorded_by drop not null;
create table public.billing_orders(
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id),scope_id uuid unique references public.catalog_scopes(id),
 requested_by uuid not null references auth.users(id),amount_cents bigint not null check(amount_cents between 1 and 100000000),
 currency text not null default 'usd' check(currency='usd'),status text not null default 'pending' check(status in ('pending','checkout','paid','expired','failed','refunded','disputed')),
 attempt integer not null default 1 check(attempt between 1 and 10),checkout_url text,receipt_url text,stripe_session_id text unique,stripe_payment_intent text unique,
 refunded_cents bigint not null default 0, last_error text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),reconciled_at timestamptz
);
alter table public.billing_orders enable row level security;
revoke all on public.billing_orders from anon,authenticated;
grant select on public.billing_orders to authenticated;
create policy billing_read on public.billing_orders for select to authenticated using(public.catalog_role(org_id)='owner' or public.catalog_desk_access());
create function public.catalog_checkout(target_scope uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.catalog_scopes; j public.catalog_jobs; b public.billing_orders;
begin
 select * into s from public.catalog_scopes where id=target_scope;
 select * into j from public.catalog_jobs where id=s.job_id for update;
 if s.id is null or public.catalog_role(s.org_id) is distinct from 'owner' or j.status not in ('awaiting_approval','queued') or s.id is distinct from (select id from public.catalog_scopes where job_id=j.id order by version desc limit 1) or not exists(select 1 from public.scope_approvals where scope_id=s.id) or s.price_cents<1 then raise exception 'Approved payable scope required' using errcode='42501'; end if;
 if exists(select 1 from public.catalog_payments where scope_id=s.id) then raise exception 'Payment already recorded; contact support' using errcode='22023'; end if;
 select * into b from public.billing_orders where scope_id=s.id for update;
 if b.id is null then
  insert into public.billing_orders(org_id,scope_id,requested_by,amount_cents) values(s.org_id,s.id,auth.uid(),s.price_cents) returning * into b;
 elsif b.status='expired' and b.attempt<10 then
  update public.billing_orders set status='pending',attempt=attempt+1,checkout_url=null,stripe_session_id=null,last_error=null,updated_at=now() where id=b.id;
 elsif b.status not in ('pending','checkout') then raise exception 'Contact support before retrying this payment' using errcode='22023'; end if;
 return b.id;
end $$;
revoke all on function public.catalog_checkout(uuid) from public,anon;
grant execute on function public.catalog_checkout(uuid) to authenticated;
-- A refund or dispute must prevent previously paid work starting again.
create function public.catalog_billing_start_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if new.status='processing' and old.status is distinct from 'processing' and exists(select 1 from public.billing_orders b join public.catalog_scopes s on s.id=b.scope_id where s.job_id=new.id and b.status in ('refunded','disputed')) then raise exception 'Billing exception requires resolution' using errcode='22023'; end if;
 return new;
end $$;
create trigger billing_start_guard before update on public.catalog_jobs for each row execute function public.catalog_billing_start_guard();

-- Source: 202611110021_recurring_capacity.sql
create table public.capacity_agreements(
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id),reference_job uuid not null references public.catalog_jobs(id),
 profile_version_id uuid not null references public.catalog_profile_versions(id),description text not null check(length(trim(description)) between 1 and 4000),
 price_cents bigint not null check(price_cents between 1 and 100000000),batches_per_month integer not null check(batches_per_month between 1 and 100),
 created_by uuid not null references auth.users(id),approved_by uuid references auth.users(id),approved_at timestamptz,
 status text not null default 'proposed' check(status in ('proposed','pending','checkout','active','past_due','cancel_requested','cancel_scheduled','cancelled','expired','failed')),
 stripe_session_id text unique,stripe_subscription_id text unique,checkout_url text,invoice_url text,
 paid_period_id text,period_start timestamptz,period_end timestamptz,last_error text,reconciled_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.capacity_usage(
 id uuid primary key default gen_random_uuid(),agreement_id uuid not null references public.capacity_agreements(id),job_id uuid not null unique references public.catalog_jobs(id),
 period_id text not null,allocated_by uuid not null references auth.users(id),created_at timestamptz not null default now()
);
alter table public.capacity_agreements enable row level security;
alter table public.capacity_usage enable row level security;
revoke all on public.capacity_agreements,public.capacity_usage from anon,authenticated;
grant select on public.capacity_agreements,public.capacity_usage to authenticated;
create policy agreements_read on public.capacity_agreements for select to authenticated using(public.catalog_role(org_id)='owner' or public.catalog_staff_access(reference_job));
create policy usage_read on public.capacity_usage for select to authenticated using(exists(select 1 from public.capacity_agreements a where a.id=agreement_id));
create function public.catalog_capacity_action(command text,payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.capacity_agreements;j public.catalog_jobs;s public.catalog_scopes;output uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if command='propose' then
  select * into j from public.catalog_jobs where id=(payload->>'jobId')::uuid;
  if j.id is null or not public.catalog_staff_access(j.id) or j.profile_version_id is null or j.status not in ('accepted','closed') then raise exception 'Accepted reference job and assigned staff required' using errcode='42501'; end if;
  insert into public.capacity_agreements(org_id,reference_job,profile_version_id,description,price_cents,batches_per_month,created_by) values(j.org_id,j.id,j.profile_version_id,payload->>'description',(payload->>'price_cents')::bigint,(payload->>'batches')::int,auth.uid()) returning id into output;
 else
  select * into a from public.capacity_agreements where id=(payload->>'id')::uuid;
  if a.id is null or public.catalog_role(a.org_id) is distinct from 'owner' then raise exception 'Workspace owner required' using errcode='42501'; end if;
  perform 1 from public.organizations where id=a.org_id for update;
  select * into a from public.capacity_agreements where id=a.id for update;
  if command='approve' then
   if a.status<>'proposed' or payload->>'approve_recurring' is distinct from 'true' or exists(select 1 from public.capacity_agreements where org_id=a.org_id and id<>a.id and status in ('pending','checkout','active','past_due','cancel_requested','cancel_scheduled')) then raise exception 'Explicit approval required; resolve current agreement first' using errcode='22023'; end if;
   update public.capacity_agreements set status='pending',approved_by=auth.uid(),approved_at=now(),updated_at=now() where id=a.id;
  elsif command='cancel' then
   if a.status not in ('active','past_due','cancel_scheduled','checkout','pending') then raise exception 'Cancellation not available' using errcode='22023'; end if;
   update public.capacity_agreements set status='cancel_requested',updated_at=now() where id=a.id;
  elsif command='allocate' then
   select * into j from public.catalog_jobs where id=(payload->>'jobId')::uuid for update;
   if j.id is null or j.org_id<>a.org_id or j.profile_version_id is distinct from a.profile_version_id or j.status not in ('submitted','scoping','awaiting_approval') or a.status not in ('active','cancel_scheduled') or a.period_end<=now() or a.period_start>now() or a.paid_period_id is null then raise exception 'Paid current capacity and matching job profile required' using errcode='22023'; end if;
   if exists(select 1 from public.capacity_usage where job_id=j.id) then return a.id; end if;
   if (select count(*) from public.capacity_usage where agreement_id=a.id and period_id=a.paid_period_id)>=a.batches_per_month then raise exception 'Capacity exhausted; request a change before extra work' using errcode='22023'; end if;
   select * into s from public.catalog_scopes where job_id=j.id order by version desc limit 1;
   if s.id is null or s.price_cents<>0 or not exists(select 1 from public.scope_approvals where scope_id=s.id) then raise exception 'Approve a zero-additional-charge included scope first' using errcode='22023'; end if;
   insert into public.capacity_usage(agreement_id,job_id,period_id,allocated_by) values(a.id,j.id,a.paid_period_id,auth.uid());
  else raise exception 'Unsupported capacity action' using errcode='22023'; end if;
  output:=a.id;
 end if;
 insert into public.organization_events(org_id,actor_id,event_type,details) values(coalesce(a.org_id,j.org_id),auth.uid(),'capacity_'||command,jsonb_build_object('agreementId',output));
 return output;
end $$;
revoke all on function public.catalog_capacity_action(text,jsonb) from public,anon;
grant execute on function public.catalog_capacity_action(text,jsonb) to authenticated;

-- Source: 202611110022_commercial_guards.sql
create table solvren_private.capacity_periods(
 agreement_id uuid not null references public.capacity_agreements(id),invoice_id text primary key,
 paid boolean not null,checked_at timestamptz not null default now()
);
create function public.catalog_current_funding(target_job uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.billing_orders b join public.catalog_scopes s on s.id=b.scope_id where s.job_id=target_job and (b.status in ('refunded','disputed') or (b.status='paid' and (b.last_error is not null or b.reconciled_at<now()-interval '5 minutes'))))
 and not exists(select 1 from public.capacity_usage u left join solvren_private.capacity_periods p on p.invoice_id=u.period_id and p.agreement_id=u.agreement_id where u.job_id=target_job and (p.invoice_id is null or not p.paid or p.checked_at<now()-interval '5 minutes'))
$$;
revoke all on function public.catalog_current_funding(uuid) from public,anon,authenticated;
create function public.catalog_funding_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare job uuid;
begin
 if tg_table_name='catalog_jobs' then
  job:=new.id;
  if new.status='cancelled' and old.status is distinct from 'cancelled' and exists(select 1 from public.billing_orders b join public.catalog_scopes s on s.id=b.scope_id where s.job_id=job and b.status in ('pending','checkout')) then raise exception 'Resolve open checkout before cancelling' using errcode='22023'; end if;
  if new.status not in ('processing','ready_for_review') or new.status=old.status then return new; end if;
 elsif tg_table_name='capacity_usage' then
  if not exists(select 1 from public.capacity_agreements a where a.id=new.agreement_id and a.status in ('active','cancel_scheduled') and a.paid_period_id=new.period_id and a.period_start<=now() and a.period_end>now() and a.last_error is null and a.reconciled_at>now()-interval '5 minutes') then raise exception 'Fresh paid capacity required' using errcode='22023'; end if;
  return new;
 else
  if new.decision<>'released' then return new; end if;
  select job_id into job from public.catalog_deliveries where id=new.delivery_id;
 end if;
 if not public.catalog_current_funding(job) then raise exception 'Refresh or resolve billing before progressing work' using errcode='22023'; end if;
 return new;
end $$;
create trigger commercial_job_guard before update on public.catalog_jobs for each row execute function public.catalog_funding_guard();
create trigger commercial_capacity_guard before insert on public.capacity_usage for each row execute function public.catalog_funding_guard();
create trigger commercial_release_guard before insert on public.delivery_decisions for each row execute function public.catalog_funding_guard();

-- Source: 202611110023_service_notifications.sql
create table solvren_private.service_outbox(
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id),
 invitation_id uuid references solvren_private.team_invitations(id),case_id uuid references public.service_cases(id),
 recipient text not null,subject text not null,body text not null,
 state text not null default 'pending' check(state in ('pending','sending','sent','failed','uncertain')),
 attempts integer not null default 0,created_at timestamptz not null default now(),started_at timestamptz,sent_at timestamptz,last_error text,
 check((invitation_id is not null)::int+(case_id is not null)::int=1)
);
-- The token is kept in the private delivery queue only until send/revocation. The invitation table retains only its hash.
do $$declare definition text;needle text;begin
 definition:=pg_get_functiondef('public.catalog_team_action(uuid,text,jsonb)'::regprocedure);
 needle:='output:=jsonb_build_object(''token'',token);';
 if position(needle in definition)=0 then raise exception 'Team function changed; review migration'; end if;
 definition:=replace(definition,needle,$replacement$
 insert into solvren_private.service_outbox(org_id,invitation_id,recipient,subject,body)
 select workspace,i.id,email_address,'Your Solvren staging invitation','You have been invited to a private Solvren staging workspace as '||requested_role||'. Sign in with this email, then open: http://127.0.0.1:3100/invite#'||token||E'\nThis link expires in seven days. Staging runs on the owner computer; contact your inviter for access. No spending is approved by accepting.' from solvren_private.team_invitations i where i.token_hash=sha256(convert_to(token,'UTF8'));
 output:=jsonb_build_object('token',token);
 $replacement$);
 execute definition;
end $$;
create function solvren_private.queue_case_message() returns trigger language plpgsql security definer set search_path='' as $$
declare c public.service_cases;actor uuid;begin
 if tg_table_name='service_cases' then c:=new;actor:=new.created_by;
 else select * into c from public.service_cases where id=new.case_id;actor:=new.actor_id;end if;
 insert into solvren_private.service_outbox(org_id,case_id,recipient,subject,body)
 select c.org_id,c.id,u.email,'Solvren staging request updated','A service request has an update. Sign in to review: http://127.0.0.1:3100/'||case when u.id=c.created_by then 'workspace' else 'operator' end||'/support/'||c.id
 from auth.users u where u.email_confirmed_at is not null and u.id<>actor and (u.id=c.created_by or u.id=c.assigned_to);
 return new;
end $$;
create trigger service_case_created after insert on public.service_cases for each row execute function solvren_private.queue_case_message();
create trigger service_case_message after insert on public.service_case_messages for each row execute function solvren_private.queue_case_message();

-- Source: 202611110024_operations_metrics.sql
create function public.catalog_operations_metrics() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.catalog_desk_access() then raise exception 'Staff MFA required' using errcode='42501'; end if;
 return jsonb_build_object(
 'pilot_requests',(select count(*) from public.service_cases where kind='pilot'),
 'unassigned_requests',(select count(*) from public.service_cases where status='open' and assigned_to is null),
 'open_requests',(select count(*) from public.service_cases where status in ('open','awaiting_customer')),
 'requests_over_two_days',(select count(*) from public.service_cases where status='open' and updated_at<now()-interval '2 days'),
 'accepted_jobs',(select count(*) from public.catalog_jobs where status in ('accepted','closed')),
 'batch_receipts_cents',(select coalesce(sum(amount_cents),0) from public.catalog_payments),
 'recorded_direct_cost_cents',(select coalesce(sum(cost_cents),0) from public.catalog_effort),
 'recorded_minutes',(select coalesce(sum(minutes),0) from public.catalog_effort),
 'correction_requests',(select count(*) from public.delivery_decisions where decision='correction'),
 'billing_attention',(select count(*) from public.billing_orders where last_error is not null or status in ('failed','disputed'))+(select count(*) from public.capacity_agreements where last_error is not null or status in ('past_due','failed')),
 'notification_attention',(select count(*) from solvren_private.service_outbox where state in ('failed','uncertain'))+(select count(*) from solvren_private.notification_outbox where state in ('failed','uncertain')),
 'pilot_sources',(select coalesce(jsonb_object_agg(source,total),'{}') from(select coalesce(qualification->>'source','unspecified') source,count(*) total from public.service_cases where kind='pilot' group by 1) counts)
 );
end $$;
revoke all on function public.catalog_operations_metrics() from public,anon;
grant execute on function public.catalog_operations_metrics() to authenticated;

-- Source: 202611110025_refund_requests.sql
create table public.billing_refunds(
 id uuid primary key,order_id uuid not null references public.billing_orders(id),amount_cents bigint not null check(amount_cents>0),
 reason text not null check(length(trim(reason)) between 1 and 2000),requested_by uuid not null references auth.users(id),
 status text not null default 'pending' check(status in ('pending','succeeded','failed','uncertain')),stripe_refund_id text unique,last_error text,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.billing_refunds enable row level security;revoke all on public.billing_refunds from anon,authenticated;grant select on public.billing_refunds to authenticated;
create policy refunds_read on public.billing_refunds for select to authenticated using(exists(select 1 from public.billing_orders b where b.id=order_id));
create function public.catalog_refund_request(target_scope uuid,request_id uuid,amount bigint,reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare b public.billing_orders;s public.catalog_scopes;r public.billing_refunds;
begin
 select * into s from public.catalog_scopes where id=target_scope;
 if s.id is null or not public.catalog_staff_access(s.job_id,true) then raise exception 'Assigned reviewer MFA required' using errcode='42501'; end if;
 select * into b from public.billing_orders where scope_id=s.id for update;
 select * into r from public.billing_refunds where id=request_id;
 if r.id is not null then
  if r.order_id is distinct from b.id or r.amount_cents is distinct from amount or r.reason is distinct from reason or r.requested_by is distinct from auth.uid() then raise exception 'Conflicting refund request' using errcode='22023'; end if;return r.id;
 end if;
 if b.id is null or b.status not in ('paid','refunded') or b.stripe_payment_intent is null or b.last_error is not null or b.reconciled_at<now()-interval '5 minutes' or amount is null or amount<1 or amount>b.amount_cents-b.refunded_cents-coalesce((select sum(amount_cents) from public.billing_refunds where order_id=b.id and status in ('pending','uncertain')),0) then raise exception 'Verified refundable balance required' using errcode='22023'; end if;
 insert into public.billing_refunds(id,order_id,amount_cents,reason,requested_by) values(request_id,b.id,amount,reason,auth.uid());
 insert into public.organization_events(org_id,actor_id,event_type,details) values(b.org_id,auth.uid(),'refund_requested',jsonb_build_object('refundId',request_id,'amount_cents',amount));
 return request_id;
end $$;
revoke all on function public.catalog_refund_request(uuid,uuid,bigint,text) from public,anon;
grant execute on function public.catalog_refund_request(uuid,uuid,bigint,text) to authenticated;

-- Source: 202611110026_refund_holds.sql
create or replace function public.catalog_current_funding(target_job uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.billing_orders b join public.catalog_scopes s on s.id=b.scope_id where s.job_id=target_job and (b.status in ('refunded','disputed') or (b.status='paid' and (b.last_error is not null or b.reconciled_at<now()-interval '5 minutes'))))
 and not exists(select 1 from public.capacity_usage u left join solvren_private.capacity_periods p on p.invoice_id=u.period_id and p.agreement_id=u.agreement_id where u.job_id=target_job and (p.invoice_id is null or not p.paid or p.checked_at<now()-interval '5 minutes'))
 and not exists(select 1 from public.billing_refunds r join public.billing_orders b on b.id=r.order_id join public.catalog_scopes s on s.id=b.scope_id where s.job_id=target_job and r.status in ('pending','uncertain'))
$$;

-- Source: 202611110027_approval_chains.sql
create table public.approval_policies(
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id),kind text not null check(kind in ('quote','delivery')),
 version integer not null,reviewers uuid[] not null check(cardinality(reviewers)<=5),created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),unique(org_id,kind,version)
);
create table public.approval_requirements(
 resource_id uuid not null,kind text not null check(kind in ('quote','delivery')),org_id uuid not null references public.organizations(id),job_id uuid not null references public.catalog_jobs(id),policy_id uuid not null references public.approval_policies(id),primary key(resource_id,kind)
);
create table public.approval_votes(
 id uuid primary key default gen_random_uuid(),resource_id uuid not null,kind text not null,step integer not null,actor_id uuid not null references auth.users(id),note text not null check(length(trim(note)) between 1 and 2000),created_at timestamptz not null default now(),
 foreign key(resource_id,kind) references public.approval_requirements(resource_id,kind),unique(resource_id,kind,step)
);
alter table public.approval_policies enable row level security;alter table public.approval_requirements enable row level security;alter table public.approval_votes enable row level security;
revoke all on public.approval_policies,public.approval_requirements,public.approval_votes from anon,authenticated;
grant select on public.approval_policies,public.approval_requirements,public.approval_votes to authenticated;
create policy approval_policy_read on public.approval_policies for select to authenticated using(public.catalog_role(org_id) is not null);
create policy approval_requirements_read on public.approval_requirements for select to authenticated using(public.catalog_role(org_id) is not null or public.catalog_staff_access(job_id));
create policy approval_votes_read on public.approval_votes for select to authenticated using(exists(select 1 from public.approval_requirements r where r.resource_id=approval_votes.resource_id and r.kind=approval_votes.kind));
create function public.catalog_approval_policy(workspace uuid,approval_kind text,steps uuid[]) returns uuid language plpgsql security definer set search_path='' as $$
declare output uuid;next_version integer;
begin
 perform 1 from public.organizations where id=workspace for update;
 if public.catalog_role(workspace) is distinct from 'owner' or steps is null or cardinality(steps)>5 or cardinality(steps)<>(select count(distinct x) from unnest(steps) x) or exists(select 1 from unnest(steps) x where not exists(select 1 from public.memberships m where m.org_id=workspace and m.user_id=x and m.role in ('owner','admin','approver'))) then raise exception 'Owner must select distinct current approvers' using errcode='42501'; end if;
 select coalesce(max(version),0)+1 into next_version from public.approval_policies where org_id=workspace and kind=approval_kind;
 insert into public.approval_policies(org_id,kind,version,reviewers,created_by) values(workspace,approval_kind,next_version,steps,auth.uid()) returning id into output;
 insert into public.organization_events(org_id,actor_id,event_type,details) values(workspace,auth.uid(),'approval_policy_versioned',jsonb_build_object('policyId',output));return output;
end $$;
create function solvren_private.snapshot_approval_policy() returns trigger language plpgsql security definer set search_path='' as $$
declare p uuid;k text;
begin
 k:=case when tg_table_name='catalog_scopes' then 'quote' else 'delivery' end;
 select id into p from public.approval_policies where org_id=new.org_id and kind=k order by version desc limit 1;
 if p is not null then insert into public.approval_requirements(resource_id,kind,org_id,job_id,policy_id) values(new.id,k,new.org_id,new.job_id,p); end if;
 return new;
end $$;
create trigger quote_approval_snapshot after insert on public.catalog_scopes for each row execute function solvren_private.snapshot_approval_policy();
create trigger delivery_approval_snapshot after insert on public.catalog_deliveries for each row execute function solvren_private.snapshot_approval_policy();
create function public.catalog_approval_state(approval_kind text,target_resource uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r public.approval_requirements;p public.approval_policies;job uuid;org uuid;
begin
 if approval_kind='quote' then select job_id,org_id into job,org from public.catalog_scopes where id=target_resource;
 elsif approval_kind='delivery' then select job_id,org_id into job,org from public.catalog_deliveries where id=target_resource and (public.catalog_staff_access(job_id) or public.catalog_delivery_released(id));end if;
 if job is null or (public.catalog_role(org) is null and not public.catalog_staff_access(job)) then raise exception 'Unavailable' using errcode='42501'; end if;
 select * into r from public.approval_requirements where resource_id=target_resource and kind=approval_kind;
 if r.resource_id is null then return jsonb_build_object('steps','[]'::jsonb,'complete',true);end if;
 select * into p from public.approval_policies where id=r.policy_id;
 return jsonb_build_object('policyVersion',p.version,'complete',cardinality(p.reviewers)=(select count(*) from public.approval_votes where resource_id=target_resource and kind=approval_kind),'steps',
 (select coalesce(jsonb_agg(jsonb_build_object('step',x.ordinality,'email',u.email,'mine',x.reviewer=auth.uid(),'approved',v.id is not null,'note',v.note) order by x.ordinality),'[]'::jsonb) from unnest(p.reviewers) with ordinality x(reviewer,ordinality) join auth.users u on u.id=x.reviewer left join public.approval_votes v on v.resource_id=target_resource and v.kind=approval_kind and v.step=x.ordinality));
end $$;
create function public.catalog_approval_vote(approval_kind text,target_resource uuid,note text) returns boolean language plpgsql security definer set search_path='' as $$
declare r public.approval_requirements;p public.approval_policies;next_step integer;
begin
 perform public.catalog_approval_state(approval_kind,target_resource);
 select * into r from public.approval_requirements where resource_id=target_resource and kind=approval_kind for update;
 select * into p from public.approval_policies where id=r.policy_id;
 if exists(select 1 from public.approval_votes where resource_id=target_resource and kind=approval_kind and actor_id=auth.uid()) then return true;end if;
 select count(*)+1 into next_step from public.approval_votes where resource_id=target_resource and kind=approval_kind;
 if p.id is null or p.reviewers[next_step] is distinct from auth.uid() or coalesce(public.catalog_role(r.org_id),'') not in ('owner','admin','approver') then raise exception 'Current assigned approval step required' using errcode='42501';end if;
 if approval_kind='quote' and target_resource is distinct from (select id from public.catalog_scopes where job_id=r.job_id order by version desc limit 1) then raise exception 'Superseded quote' using errcode='22023';end if;
 if approval_kind='delivery' and target_resource is distinct from (select id from public.catalog_deliveries where job_id=r.job_id order by version desc limit 1) then raise exception 'Superseded delivery' using errcode='22023';end if;
 insert into public.approval_votes(resource_id,kind,step,actor_id,note) values(target_resource,approval_kind,next_step,auth.uid(),note);return true;
end $$;
create function solvren_private.require_approval_chain() returns trigger language plpgsql security definer set search_path='' as $$
declare resource uuid;k text;r public.approval_requirements;required integer;
begin
 if tg_table_name='scope_approvals' then resource:=new.scope_id;k:='quote';else if new.decision<>'accepted' then return new;end if;resource:=new.delivery_id;k:='delivery';end if;
 select * into r from public.approval_requirements where resource_id=resource and kind=k;
 if r.resource_id is not null then
  select cardinality(reviewers) into required from public.approval_policies where id=r.policy_id;
  if required<>(select count(*) from public.approval_votes where resource_id=resource and kind=k) then raise exception 'Complete required approval chain first' using errcode='22023';end if;
 end if;
 return new;
end $$;
create trigger require_quote_approval_chain before insert on public.scope_approvals for each row execute function solvren_private.require_approval_chain();
create trigger require_delivery_approval_chain before insert on public.delivery_decisions for each row execute function solvren_private.require_approval_chain();
revoke all on function public.catalog_approval_policy(uuid,text,uuid[]),public.catalog_approval_state(text,uuid),public.catalog_approval_vote(text,uuid,text) from public,anon;
grant execute on function public.catalog_approval_policy(uuid,text,uuid[]),public.catalog_approval_state(text,uuid),public.catalog_approval_vote(text,uuid,text) to authenticated;

-- Source: 202611110028_sites_and_workforce.sql
alter table public.organizations add column workspace_kind text not null default 'customer' check(workspace_kind in ('customer','partner'));
create table public.organization_sites(id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id),name text not null check(length(trim(name)) between 1 and 120),active boolean not null default true,created_at timestamptz not null default now(),unique(org_id,id),unique(org_id,name));
alter table public.catalog_jobs add column site_id uuid;
alter table public.catalog_jobs add constraint job_site_tenant foreign key(org_id,site_id) references public.organization_sites(org_id,id);
alter table public.organization_sites enable row level security;revoke all on public.organization_sites from anon,authenticated;grant select on public.organization_sites to authenticated;
create policy sites_read on public.organization_sites for select to authenticated using(public.catalog_role(org_id) is not null);
create function public.catalog_site_action(workspace uuid,command text,payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare role_name text:=public.catalog_role(workspace);output uuid;j public.catalog_jobs;
begin
 if role_name is null then raise exception 'Unavailable' using errcode='42501';end if;
 if command='job' then
  select * into j from public.catalog_jobs where id=(payload->>'jobId')::uuid and org_id=workspace for update;
  if role_name not in ('owner','admin','contributor') or j.id is null or j.status<>'draft' then raise exception 'Editable draft required' using errcode='42501';end if;
  output:=nullif(payload->>'siteId','')::uuid;
  if output is not null and not exists(select 1 from public.organization_sites where id=output and org_id=workspace and active) then raise exception 'Active site required' using errcode='22023';end if;
  update public.catalog_jobs set site_id=output,revision=revision+1,updated_at=now() where id=j.id;
 elsif command='kind' then
  if role_name<>'owner' then raise exception 'Owner required' using errcode='42501';end if;
  update public.organizations set workspace_kind=payload->>'kind' where id=workspace;output:=workspace;
 else
  if role_name not in ('owner','admin') then raise exception 'Administrator required' using errcode='42501';end if;
  if command='create' then insert into public.organization_sites(org_id,name) values(workspace,trim(payload->>'name')) returning id into output;
  elsif command='archive' then update public.organization_sites set active=false where id=(payload->>'id')::uuid and org_id=workspace returning id into output;if output is null then raise exception 'Site unavailable' using errcode='42501';end if;
  else raise exception 'Unknown action' using errcode='22023';end if;
 end if;
 insert into public.organization_events(org_id,actor_id,event_type,details) values(workspace,auth.uid(),'site_'||command,jsonb_build_object('id',output,'jobId',j.id));return output;
end $$;
revoke all on function public.catalog_site_action(uuid,text,jsonb) from public,anon;grant execute on function public.catalog_site_action(uuid,text,jsonb) to authenticated;

create table solvren_private.staff_permissions(user_id uuid primary key references solvren_private.staff_members(user_id),can_manage boolean not null default false,can_support boolean not null default false,hourly_cost_cents integer check(hourly_cost_cents between 0 and 100000));
create table solvren_private.staff_audit(id uuid primary key default gen_random_uuid(),actor_id uuid references auth.users(id),action text not null,details jsonb not null,created_at timestamptz not null default now());
-- Carry forward the user-designated initial operator, not customer organization ownership.
insert into solvren_private.staff_permissions(user_id,can_manage,can_support) select s.user_id,true,true from solvren_private.staff_members s join auth.users u on u.id=s.user_id join solvren_private.operator_allowlist a on a.email=lower(u.email) and a.enabled where lower(u.email)='recovery-operator@example.invalid' and u.email_confirmed_at is not null and s.enabled;
create function public.catalog_manager_access() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(auth.jwt()->>'aal'='aal2',false) and exists(select 1 from solvren_private.staff_members s join auth.users u on u.id=s.user_id and u.email_confirmed_at is not null join solvren_private.operator_allowlist a on a.email=lower(u.email) and a.enabled join solvren_private.staff_permissions p on p.user_id=s.user_id and p.can_manage where s.user_id=auth.uid() and s.enabled)
$$;
revoke all on function public.catalog_manager_access() from public,anon;grant execute on function public.catalog_manager_access() to authenticated;
create or replace function public.catalog_desk_access() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(auth.jwt()->>'aal'='aal2',false) and exists(select 1 from solvren_private.staff_members s join auth.users u on u.id=s.user_id and u.email_confirmed_at is not null join solvren_private.operator_allowlist a on a.email=lower(u.email) and a.enabled join solvren_private.staff_permissions p on p.user_id=s.user_id and (p.can_support or p.can_manage) where s.user_id=auth.uid() and s.enabled)
$$;
create function public.catalog_workforce_action(command text,payload jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare target uuid;job uuid;
begin
 if not public.catalog_manager_access() then raise exception 'Manager MFA required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(110028);
 if command='staff' then
  select id into target from auth.users where lower(email)=lower(trim(payload->>'email')) and email_confirmed_at is not null;
  if target is null then raise exception 'Verified account required before staff access' using errcode='22023';end if;
  if target=auth.uid() and (payload->>'enabled' is distinct from 'true' or payload->>'can_manage' is distinct from 'true') then raise exception 'Cannot remove your own manager access' using errcode='42501';end if;
  insert into solvren_private.operator_allowlist(email,enabled) select lower(email),(payload->>'enabled')::boolean from auth.users where id=target on conflict(email) do update set enabled=excluded.enabled;
  insert into solvren_private.staff_members(user_id,enabled) values(target,(payload->>'enabled')::boolean) on conflict(user_id) do update set enabled=excluded.enabled;
  insert into solvren_private.staff_permissions(user_id,can_manage,can_support,hourly_cost_cents) values(target,(payload->>'can_manage')::boolean,(payload->>'can_support')::boolean,nullif(payload->>'hourly_cost_cents','')::integer) on conflict(user_id) do update set can_manage=excluded.can_manage,can_support=excluded.can_support,hourly_cost_cents=excluded.hourly_cost_cents;
 elsif command='assign' then
  target:=(payload->>'userId')::uuid;job:=(payload->>'jobId')::uuid;
  if not exists(select 1 from solvren_private.staff_members where user_id=target and enabled) or not exists(select 1 from public.catalog_jobs where id=job) then raise exception 'Active operator and job required' using errcode='22023';end if;
  insert into solvren_private.staff_assignments(job_id,user_id,can_review) values(job,target,(payload->>'can_review')::boolean) on conflict(job_id,user_id) do update set can_review=excluded.can_review;
 elsif command='unassign' then
  target:=(payload->>'userId')::uuid;job:=(payload->>'jobId')::uuid;delete from solvren_private.staff_assignments where job_id=job and user_id=target;
 else raise exception 'Unsupported action' using errcode='22023';end if;
 insert into solvren_private.staff_audit(actor_id,action,details) values(auth.uid(),command,jsonb_build_object('userId',target,'jobId',job,'settings',payload));return true;
end $$;
alter table public.catalog_effort add column labor_cost_cents bigint;
create function solvren_private.price_effort() returns trigger language plpgsql security definer set search_path='' as $$
begin select ceil(new.minutes::numeric*p.hourly_cost_cents/60)::bigint into new.labor_cost_cents from solvren_private.staff_permissions p where p.user_id=new.recorded_by;return new;end $$;
create trigger effort_cost_snapshot before insert on public.catalog_effort for each row execute function solvren_private.price_effort();
create function public.catalog_workforce_state() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.catalog_manager_access() then raise exception 'Manager MFA required' using errcode='42501';end if;
 return jsonb_build_object('staff',(select coalesce(jsonb_agg(jsonb_build_object('id',s.user_id,'email',u.email,'enabled',s.enabled,'can_manage',coalesce(p.can_manage,false),'can_support',coalesce(p.can_support,false),'hourly_cost_cents',p.hourly_cost_cents,'weekly_minutes',coalesce(c.weekly_minutes,0))),'[]') from solvren_private.staff_members s join auth.users u on u.id=s.user_id left join solvren_private.staff_permissions p on p.user_id=s.user_id left join solvren_private.catalog_capacity c on c.user_id=s.user_id),
 'jobs',(select coalesce(jsonb_agg(row_to_json(j)),'[]') from(select id,title,status,org_id,planned_minutes from public.catalog_jobs where status not in ('closed','cancelled') order by updated_at desc limit 200) j),
 'assignments',(select coalesce(jsonb_agg(jsonb_build_object('job_id',job_id,'user_id',user_id,'can_review',can_review)),'[]') from solvren_private.staff_assignments),
 'costs',(select jsonb_build_object('labor_cents',coalesce(sum(labor_cost_cents),0),'direct_cents',coalesce(sum(cost_cents),0),'minutes',coalesce(sum(minutes),0),'unpriced_entries',count(*) filter(where labor_cost_cents is null)) from public.catalog_effort));
end $$;
revoke all on function public.catalog_workforce_action(text,jsonb),public.catalog_workforce_state() from public,anon;grant execute on function public.catalog_workforce_action(text,jsonb),public.catalog_workforce_state() to authenticated;

-- Source: 202611110029_permissions_queue.sql
create or replace function public.catalog_operations_metrics() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.catalog_manager_access() then raise exception 'Manager MFA required' using errcode='42501'; end if;
 return jsonb_build_object(
 'pilot_requests',(select count(*) from public.service_cases where kind='pilot'),
 'unassigned_requests',(select count(*) from public.service_cases where status='open' and assigned_to is null),
 'open_requests',(select count(*) from public.service_cases where status in ('open','awaiting_customer')),
 'requests_over_two_days',(select count(*) from public.service_cases where status='open' and updated_at<now()-interval '2 days'),
 'accepted_jobs',(select count(*) from public.catalog_jobs where status in ('accepted','closed')),
 'batch_receipts_cents',(select coalesce(sum(amount_cents),0) from public.catalog_payments),
 'recorded_direct_cost_cents',(select coalesce(sum(cost_cents),0) from public.catalog_effort),
 'recorded_minutes',(select coalesce(sum(minutes),0) from public.catalog_effort),
 'correction_requests',(select count(*) from public.delivery_decisions where decision='correction'),
 'billing_attention',(select count(*) from public.billing_orders where last_error is not null or status in ('failed','disputed'))+(select count(*) from public.capacity_agreements where last_error is not null or status in ('past_due','failed')),
 'notification_attention',(select count(*) from solvren_private.service_outbox where state in ('failed','uncertain'))+(select count(*) from solvren_private.notification_outbox where state in ('failed','uncertain')),
 'pilot_sources',(select coalesce(jsonb_object_agg(source,total),'{}') from(select coalesce(qualification->>'source','unspecified') source,count(*) total from public.service_cases where kind='pilot' group by 1) counts)
 );
end $$;
revoke all on function public.catalog_operations_metrics() from public,anon;
grant execute on function public.catalog_operations_metrics() to authenticated;


-- Source: 202611110030_assignment_queue.sql
create function public.catalog_assigned_queue(after_id uuid default null, page_size integer default 50, status_filter text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if page_size is null or page_size < 1 or page_size > 100 then raise exception 'Page size must be 1–100' using errcode='22023'; end if;
 if not coalesce(auth.jwt()->>'aal'='aal2',false) then raise exception 'Staff MFA required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.id),'[]'::jsonb) into result from (
 select j.id,j.title,j.status,j.updated_at from solvren_private.staff_assignments a join public.catalog_jobs j on j.id=a.job_id
 where a.user_id=auth.uid() and public.catalog_staff_access(j.id) and (after_id is null or j.id>after_id) and (status_filter is null or j.status=status_filter)
 order by j.id limit page_size+1) q;
 return jsonb_build_object('jobs',result);
end $$;
revoke all on function public.catalog_assigned_queue(uuid,integer,text) from public,anon;
grant execute on function public.catalog_assigned_queue(uuid,integer,text) to authenticated;
create index staff_assignments_user_job on solvren_private.staff_assignments(user_id,job_id);

-- Source: 202611110031_refund_authority.sql
create or replace function public.catalog_refund_request(target_scope uuid,request_id uuid,amount bigint,reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare b public.billing_orders;s public.catalog_scopes;r public.billing_refunds;
begin
 select * into s from public.catalog_scopes where id=target_scope;
 if s.id is null or not public.catalog_manager_access() or not public.catalog_staff_access(s.job_id) then raise exception 'Assigned manager MFA required' using errcode='42501'; end if;
 select * into b from public.billing_orders where scope_id=s.id for update;
 select * into r from public.billing_refunds where id=request_id;
 if r.id is not null then
  if r.order_id is distinct from b.id or r.amount_cents is distinct from amount or r.reason is distinct from reason or r.requested_by is distinct from auth.uid() then raise exception 'Conflicting refund request' using errcode='22023'; end if;return r.id;
 end if;
 if b.id is null or b.status not in ('paid','refunded') or b.stripe_payment_intent is null or b.last_error is not null or b.reconciled_at<now()-interval '5 minutes' or amount is null or amount<1 or amount>b.amount_cents-b.refunded_cents-coalesce((select sum(amount_cents) from public.billing_refunds where order_id=b.id and status in ('pending','uncertain')),0) then raise exception 'Verified refundable balance required' using errcode='22023'; end if;
 insert into public.billing_refunds(id,order_id,amount_cents,reason,requested_by) values(request_id,b.id,amount,reason,auth.uid());
 insert into public.organization_events(org_id,actor_id,event_type,details) values(b.org_id,auth.uid(),'refund_requested',jsonb_build_object('refundId',request_id,'amount_cents',amount));
 return request_id;
end $$;
revoke all on function public.catalog_refund_request(uuid,uuid,bigint,text) from public,anon;
grant execute on function public.catalog_refund_request(uuid,uuid,bigint,text) to authenticated;


-- Source: 202611110032_operations_health.sql
create function public.catalog_operations_health() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.catalog_desk_access() then raise exception 'Support MFA required' using errcode='42501'; end if;
 return jsonb_build_object(
 'open_requests',(select count(*) from public.service_cases where status in ('open','awaiting_customer')),
 'unassigned_requests',(select count(*) from public.service_cases where status='open' and assigned_to is null),
 'requests_over_two_days',(select count(*) from public.service_cases where status='open' and updated_at<now()-interval '2 days'),
 'notification_attention',(select count(*) from solvren_private.service_outbox where state in ('failed','uncertain'))+(select count(*) from solvren_private.notification_outbox where state in ('failed','uncertain')));
end $$;
revoke all on function public.catalog_operations_health() from public,anon;
grant execute on function public.catalog_operations_health() to authenticated;

-- Source: 202611110033_workforce_search.sql
create function public.catalog_assignment_candidates(search_text text default '',after_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.catalog_manager_access() then raise exception 'Manager MFA required' using errcode='42501';end if;
 if search_text is null or length(search_text)>120 then raise exception 'Invalid search' using errcode='22023';end if;
 return (select coalesce(jsonb_agg(to_jsonb(q) order by q.id),'[]'::jsonb) from (
  select id,title,status from public.catalog_jobs
  where status not in ('closed','cancelled') and (after_id is null or id>after_id)
   and (search_text='' or strpos(lower(title),lower(search_text))>0 or id::text=search_text)
  order by id limit 51
 ) q);
end $$;
revoke all on function public.catalog_assignment_candidates(text,uuid) from public,anon;
grant execute on function public.catalog_assignment_candidates(text,uuid) to authenticated;

-- Source: 202611110034_operator_eligibility.sql
create function public.catalog_operator_eligible() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u join solvren_private.operator_allowlist a on a.email=lower(u.email) and a.enabled where u.id=auth.uid() and u.email_confirmed_at is not null)
$$;
revoke all on function public.catalog_operator_eligible() from public,anon;
grant execute on function public.catalog_operator_eligible() to authenticated;

-- Source: 202611110035_queue_scheduling.sql
alter table public.catalog_jobs add column planned_due_at timestamptz;
alter table public.catalog_jobs add column next_update_at timestamptz;
alter table public.catalog_jobs add constraint job_schedule_bounds check (
 (planned_due_at is null or planned_due_at between '2000-01-01'::timestamptz and '2200-01-01'::timestamptz)
 and (next_update_at is null or next_update_at between '2000-01-01'::timestamptz and '2200-01-01'::timestamptz));

create function public.catalog_schedule_job(target_job uuid,expected_revision integer,due_at timestamptz,update_at timestamptz,reason text)
returns boolean language plpgsql security definer set search_path='' as $$
declare j public.catalog_jobs;
begin
 select * into j from public.catalog_jobs where id=target_job for update;
 if j.id is null or not public.catalog_staff_access(j.id) then raise exception 'Assigned staff MFA required' using errcode='42501';end if;
 if j.revision<>expected_revision then raise exception 'Job changed; refresh before scheduling' using errcode='40001';end if;
 if reason is null or length(trim(reason)) not between 1 and 1000 then raise exception 'Scheduling reason required' using errcode='22023';end if;
 update public.catalog_jobs set planned_due_at=due_at,next_update_at=update_at,revision=revision+1,updated_at=now() where id=j.id;
 insert into public.job_events(org_id,job_id,actor_id,event_type,revision,details)
 values(j.org_id,j.id,auth.uid(),'schedule:'||gen_random_uuid(),j.revision+1,jsonb_build_object('previousDue',j.planned_due_at,'due',due_at,'previousUpdate',j.next_update_at,'nextUpdate',update_at,'reason',reason));
 return true;
end $$;

create function public.catalog_queue_page(cursor_due timestamptz default null,cursor_id uuid default null,status_filter text default null,blocked_only boolean default false,assignee uuid default null,unassigned_only boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare manager boolean:=public.catalog_manager_access();target uuid:=coalesce(assignee,auth.uid());
begin
 if not coalesce(auth.jwt()->>'aal'='aal2',false) then raise exception 'MFA required' using errcode='42501';end if;
 if (unassigned_only or target<>auth.uid()) and not manager then raise exception 'Manager required' using errcode='42501';end if;
 if (cursor_due is null)<>(cursor_id is null) then raise exception 'Complete page cursor required' using errcode='22023';end if;
 return (select coalesce(jsonb_agg(to_jsonb(q) order by q.sort_due,q.id),'[]'::jsonb) from (
  select j.id,j.title,j.status,j.planned_due_at,j.next_update_at,j.hold_reason,
   coalesce(j.planned_due_at,'9999-12-31'::timestamptz) sort_due,public.catalog_staff_access(j.id) can_open
  from public.catalog_jobs j
  where (case when unassigned_only then not exists(select 1 from solvren_private.staff_assignments a where a.job_id=j.id)
   else exists(select 1 from solvren_private.staff_assignments a where a.job_id=j.id and a.user_id=target) end)
   and (manager or public.catalog_staff_access(j.id))
   and (status_filter is null or j.status=status_filter)
   and (not blocked_only or j.status='awaiting_customer' or j.hold_reason is not null)
   and (cursor_id is null or (coalesce(j.planned_due_at,'9999-12-31'::timestamptz),j.id)>(cursor_due,cursor_id))
  order by coalesce(j.planned_due_at,'9999-12-31'::timestamptz),j.id limit 51
 ) q);
end $$;
create index catalog_jobs_schedule on public.catalog_jobs(coalesce(planned_due_at,'9999-12-31'::timestamptz),id);
revoke all on function public.catalog_schedule_job(uuid,integer,timestamptz,timestamptz,text),public.catalog_queue_page(timestamptz,uuid,text,boolean,uuid,boolean) from public,anon;
grant execute on function public.catalog_schedule_job(uuid,integer,timestamptz,timestamptz,text),public.catalog_queue_page(timestamptz,uuid,text,boolean,uuid,boolean) to authenticated;

-- Source: 202611110036_manual_receipt_authority.sql
-- Keep the established service workflow, but place financial mutations behind
-- the same manager boundary as refunds. The old implementation is not public.
alter function public.catalog_service_action(uuid,text,jsonb) set schema solvren_private;
revoke all on function solvren_private.catalog_service_action(uuid,text,jsonb) from public,anon,authenticated;
create function public.catalog_service_action(target_job uuid,command text,payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 if command='payment' and not public.catalog_manager_access() then
  raise exception 'Manager MFA required to record money' using errcode='42501';
 end if;
 return solvren_private.catalog_service_action(target_job,command,payload);
end $$;
revoke all on function public.catalog_service_action(uuid,text,jsonb) from public,anon;
grant execute on function public.catalog_service_action(uuid,text,jsonb) to authenticated;

-- Source: 202611110037_staff_identity_binding.sql
-- Consume email invitations into stable identity bindings. Email changes must
-- neither remove existing access nor transfer it to the next mailbox holder.
alter table solvren_private.operator_allowlist add column user_id uuid unique references auth.users(id);
update solvren_private.operator_allowlist a set user_id=s.user_id
from solvren_private.staff_members s join auth.users u on u.id=s.user_id
where a.email=lower(u.email) and u.email_confirmed_at is not null;

create function solvren_private.bind_staff_identity() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from solvren_private.operator_allowlist where user_id=new.user_id) then
  update solvren_private.operator_allowlist a set user_id=new.user_id
  from auth.users u where u.id=new.user_id and u.email_confirmed_at is not null
   and a.email=lower(u.email) and a.user_id is null and a.enabled;
 end if;
 if not exists(select 1 from solvren_private.operator_allowlist where user_id=new.user_id) then
  raise exception 'Identity authorization required' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function solvren_private.bind_staff_identity() from public,anon,authenticated;
create trigger staff_identity_binding before insert on solvren_private.staff_members
for each row execute function solvren_private.bind_staff_identity();

create or replace function public.catalog_operator_eligible() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u join solvren_private.operator_allowlist a
 on (a.user_id=u.id or (a.user_id is null and a.email=lower(u.email))) and a.enabled
 where u.id=auth.uid() and u.email_confirmed_at is not null)
$$;

create or replace function public.activate_catalog_operator() returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or (auth.jwt()->>'aal') is distinct from 'aal2' or not public.catalog_operator_eligible() then
  raise exception 'Authorized identity and MFA required' using errcode='42501';
 end if;
 insert into solvren_private.staff_members(user_id) values(auth.uid()) on conflict(user_id) do nothing;
 return exists(select 1 from solvren_private.staff_members where user_id=auth.uid() and enabled);
end $$;

create or replace function public.catalog_staff_access(target_job uuid,require_review boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(auth.jwt()->>'aal'='aal2',false) and exists(
 select 1 from solvren_private.staff_members s join auth.users u on u.id=s.user_id
 join solvren_private.operator_allowlist a on a.user_id=s.user_id and a.enabled
 join solvren_private.staff_assignments j on j.user_id=s.user_id
 where s.user_id=auth.uid() and s.enabled and u.email_confirmed_at is not null
 and j.job_id=target_job and (not require_review or j.can_review))
$$;

create or replace function public.catalog_manager_access() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(auth.jwt()->>'aal'='aal2',false) and exists(select 1 from solvren_private.staff_members s
 join auth.users u on u.id=s.user_id and u.email_confirmed_at is not null
 join solvren_private.operator_allowlist a on a.user_id=s.user_id and a.enabled
 join solvren_private.staff_permissions p on p.user_id=s.user_id and p.can_manage
 where s.user_id=auth.uid() and s.enabled)
$$;
create or replace function public.catalog_desk_access() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(auth.jwt()->>'aal'='aal2',false) and exists(select 1 from solvren_private.staff_members s
 join auth.users u on u.id=s.user_id and u.email_confirmed_at is not null
 join solvren_private.operator_allowlist a on a.user_id=s.user_id and a.enabled
 join solvren_private.staff_permissions p on p.user_id=s.user_id and (p.can_manage or p.can_support)
 where s.user_id=auth.uid() and s.enabled)
$$;

create or replace function public.catalog_workforce_action(command text,payload jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare target uuid;job uuid;
begin
 if not public.catalog_manager_access() then raise exception 'Manager MFA required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(110028);
 if command='staff' then
  select id into target from auth.users where lower(email)=lower(trim(payload->>'email')) and email_confirmed_at is not null;
  if target is null then raise exception 'Verified account required before staff access' using errcode='22023';end if;
  if target=auth.uid() and (payload->>'enabled' is distinct from 'true' or payload->>'can_manage' is distinct from 'true') then raise exception 'Cannot remove your own manager access' using errcode='42501';end if;
  if exists(select 1 from solvren_private.operator_allowlist where user_id=target) then
   update solvren_private.operator_allowlist set enabled=(payload->>'enabled')::boolean where user_id=target;
  else
   insert into solvren_private.operator_allowlist(email,enabled,user_id)
   select lower(email),(payload->>'enabled')::boolean,target from auth.users where id=target
   on conflict(email) do update set enabled=excluded.enabled,user_id=excluded.user_id
   where solvren_private.operator_allowlist.user_id is null;
   if not found then raise exception 'Email invitation belongs to another identity; explicit security review required' using errcode='42501';end if;
  end if;
  insert into solvren_private.staff_members(user_id,enabled) values(target,(payload->>'enabled')::boolean) on conflict(user_id) do update set enabled=excluded.enabled;
  insert into solvren_private.staff_permissions(user_id,can_manage,can_support,hourly_cost_cents) values(target,(payload->>'can_manage')::boolean,(payload->>'can_support')::boolean,nullif(payload->>'hourly_cost_cents','')::integer) on conflict(user_id) do update set can_manage=excluded.can_manage,can_support=excluded.can_support,hourly_cost_cents=excluded.hourly_cost_cents;
 elsif command='assign' then
  target:=(payload->>'userId')::uuid;job:=(payload->>'jobId')::uuid;
  if not exists(select 1 from solvren_private.staff_members where user_id=target and enabled) or not exists(select 1 from public.catalog_jobs where id=job) then raise exception 'Active operator and job required' using errcode='22023';end if;
  insert into solvren_private.staff_assignments(job_id,user_id,can_review) values(job,target,(payload->>'can_review')::boolean) on conflict(job_id,user_id) do update set can_review=excluded.can_review;
 elsif command='unassign' then
  target:=(payload->>'userId')::uuid;job:=(payload->>'jobId')::uuid;delete from solvren_private.staff_assignments where job_id=job and user_id=target;
 else raise exception 'Unsupported action' using errcode='22023';end if;
 insert into solvren_private.staff_audit(actor_id,action,details) values(auth.uid(),command,jsonb_build_object('userId',target,'jobId',job,'settings',payload));return true;
end $$;

-- Source: 202611110038_queue_filters.sql
drop function public.catalog_queue_page(timestamptz,uuid,text,boolean,uuid,boolean);
create function public.catalog_queue_page(cursor_due timestamptz default null,cursor_id uuid default null,status_filter text default null,blocked_only boolean default false,assignee uuid default null,unassigned_only boolean default false,due_filter text default null,organization_filter uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare manager boolean:=public.catalog_manager_access();target uuid:=coalesce(assignee,auth.uid());
begin
 if not coalesce(auth.jwt()->>'aal'='aal2',false) then raise exception 'MFA required' using errcode='42501';end if;
 if (unassigned_only or target<>auth.uid()) and not manager then raise exception 'Manager required' using errcode='42501';end if;
 if (cursor_due is null)<>(cursor_id is null) then raise exception 'Complete page cursor required' using errcode='22023';end if;
 if due_filter is not null and due_filter not in ('overdue','week','unscheduled') then raise exception 'Invalid due filter' using errcode='22023';end if;
 return (select coalesce(jsonb_agg(to_jsonb(q) order by q.sort_due,q.id),'[]'::jsonb) from (
  select j.id,j.title,j.status,j.planned_due_at,j.next_update_at,j.hold_reason,
   coalesce(j.planned_due_at,'9999-12-31'::timestamptz) sort_due,public.catalog_staff_access(j.id) can_open
  from public.catalog_jobs j
  where (case when unassigned_only then not exists(select 1 from solvren_private.staff_assignments a where a.job_id=j.id)
   else exists(select 1 from solvren_private.staff_assignments a where a.job_id=j.id and a.user_id=target) end)
   and (manager or public.catalog_staff_access(j.id))
   and (organization_filter is null or j.org_id=organization_filter)
   and (due_filter is null or (due_filter='unscheduled' and j.planned_due_at is null) or (due_filter='overdue' and j.planned_due_at<now() and j.status not in ('accepted','closed','cancelled')) or (due_filter='week' and j.planned_due_at between now() and now()+interval '7 days' and j.status not in ('accepted','closed','cancelled')))
   and (status_filter is null or j.status=status_filter)
   and (not blocked_only or j.status='awaiting_customer' or j.hold_reason is not null)
   and (cursor_id is null or (coalesce(j.planned_due_at,'9999-12-31'::timestamptz),j.id)>(cursor_due,cursor_id))
  order by coalesce(j.planned_due_at,'9999-12-31'::timestamptz),j.id limit 51
 ) q);
end $$;

revoke all on function public.catalog_queue_page(timestamptz,uuid,text,boolean,uuid,boolean,text,uuid) from public,anon;
grant execute on function public.catalog_queue_page(timestamptz,uuid,text,boolean,uuid,boolean,text,uuid) to authenticated;

-- Source: 202611110039_leave_workspace.sql
-- Leaving a shared workspace removes access, never the organization's records.
create function public.catalog_leave_workspace(workspace uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();member_role text;
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501';end if;
 perform 1 from public.organizations where id=workspace for update;
 select role into member_role from public.memberships where org_id=workspace and user_id=actor;
 if member_role is null then raise exception 'Workspace unavailable' using errcode='42501';end if;
 if member_role='owner' and not exists(select 1 from public.memberships where org_id=workspace and role='owner' and user_id<>actor) then
  raise exception 'Transfer ownership before leaving this workspace' using errcode='22023';
 end if;
 -- Bound invitations must not silently restore access after the member leaves.
 update solvren_private.team_invitations set revoked_at=now()
 where org_id=workspace and accepted_at is null and revoked_at is null
 and email=(select lower(email) from auth.users where id=actor);
 insert into public.organization_events(org_id,actor_id,event_type,details)
 values(workspace,actor,'member_left',jsonb_build_object('previous_role',member_role));
 delete from public.memberships where org_id=workspace and user_id=actor;
 return true;
end $$;
revoke all on function public.catalog_leave_workspace(uuid) from public,anon;
grant execute on function public.catalog_leave_workspace(uuid) to authenticated;

-- Source: 202611120040_data_requests.sql
-- Data lifecycle requests are durable; this migration grants NO deletion capability.
create table public.catalog_data_requests (
 id uuid primary key default gen_random_uuid(),
 requested_by uuid not null references auth.users(id),
 org_id uuid references public.organizations(id),
 kind text not null check(kind in ('personal_export','organization_export','personal_closure','organization_closure')),
 status text not null check(status in ('requested','preparing','completed','blocked','failed','cancelled')),
 blockers text[] not null default '{}',
 policy_version text not null default 'retention-v0.1',
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 not_before timestamptz, completed_at timestamptz,
 check((kind like 'organization_%')=(org_id is not null))
);
create unique index catalog_data_request_active on public.catalog_data_requests
 (requested_by,kind,coalesce(org_id,'00000000-0000-0000-0000-000000000000'::uuid))
 where status in ('requested','preparing','blocked');
alter table public.catalog_data_requests enable row level security;
revoke all on public.catalog_data_requests from anon,authenticated;
grant select on public.catalog_data_requests to authenticated;
create policy own_data_requests on public.catalog_data_requests for select to authenticated
 using(requested_by=auth.uid() and (org_id is null or public.catalog_role(org_id)='owner'));

create function public.catalog_request_data(request_kind text,workspace uuid default null)
 returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result uuid; reasons text[]:='{}';
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then
  raise exception 'Verified account required' using errcode='42501';
 end if;
 if request_kind not in ('personal_export','organization_export','personal_closure','organization_closure')
 or request_kind is null or ((request_kind like 'organization_%') is distinct from (workspace is not null)) then
  raise exception 'Invalid data request' using errcode='22023';
 end if;
 -- Serialize duplicate requests, including personal requests without an organization.
 perform pg_advisory_xact_lock(hashtextextended(actor::text,40));
 if workspace is not null then
  perform 1 from public.organizations where id=workspace for update;
  if public.catalog_role(workspace) is distinct from 'owner' or coalesce(auth.jwt()->>'aal','')<>'aal2' then
   raise exception 'Workspace owner with MFA required' using errcode='42501';
  end if;
 end if;
 select id into result from public.catalog_data_requests
 where requested_by=actor and kind=request_kind and org_id is not distinct from workspace
 and status in ('requested','preparing','blocked');
 if result is not null then return result;end if;
 if (select count(*) from public.catalog_data_requests where requested_by=actor and created_at>now()-interval '1 day')>=10 then
  raise exception 'Daily data request limit reached' using errcode='22023';
 end if;
 if request_kind like '%_closure' then
  reasons:=array['deletion_disabled'];
  if request_kind='personal_closure' and exists(
   select 1 from public.memberships m where m.user_id=actor and m.role='owner'
   and not exists(select 1 from public.memberships other where other.org_id=m.org_id and other.role='owner' and other.user_id<>actor)
  ) then reasons:=array_append(reasons,'ownership_transfer_required');end if;
  if workspace is not null then
   if exists(select 1 from public.catalog_jobs where org_id=workspace and status not in ('accepted','closed','cancelled')) then reasons:=array_append(reasons,'unfinished_jobs');end if;
   if exists(select 1 from public.billing_orders where org_id=workspace and status in ('pending','checkout','disputed')) then reasons:=array_append(reasons,'unsettled_billing');end if;
   if exists(select 1 from public.billing_refunds r join public.billing_orders b on b.id=r.order_id where b.org_id=workspace and r.status in ('pending','uncertain')) then reasons:=array_append(reasons,'unsettled_refunds');end if;
   if exists(select 1 from public.capacity_agreements where org_id=workspace and status in ('pending','checkout','active','past_due','cancel_requested','cancel_scheduled')) then reasons:=array_append(reasons,'recurring_agreement');end if;
  end if;
 end if;
 insert into public.catalog_data_requests(requested_by,org_id,kind,status,blockers,not_before)
 values(actor,workspace,request_kind,case when cardinality(reasons)>0 then 'blocked' else 'requested' end,reasons,
 case when request_kind like '%_closure' then now()+interval '30 days' end) returning id into result;
 if workspace is not null then
  insert into public.organization_events(org_id,actor_id,event_type,details)
  values(workspace,actor,'data_request_created',jsonb_build_object('request_id',result,'kind',request_kind));
 end if;
 return result;
end $$;
revoke all on function public.catalog_request_data(text,uuid) from public,anon;
grant execute on function public.catalog_request_data(text,uuid) to authenticated;

create function public.catalog_cancel_data_request(request_id uuid) returns boolean
 language plpgsql security definer set search_path='' as $$
declare r public.catalog_data_requests;
begin
 select * into r from public.catalog_data_requests where id=request_id for update;
 if r.id is null or r.requested_by is distinct from auth.uid() or
 (r.org_id is not null and (public.catalog_role(r.org_id) is distinct from 'owner' or coalesce(auth.jwt()->>'aal','')<>'aal2')) then
  raise exception 'Request unavailable' using errcode='42501';end if;
 if r.status='cancelled' then return true;end if;
 if r.status not in ('requested','preparing','blocked','failed') then raise exception 'Request already complete' using errcode='22023';end if;
 update public.catalog_data_requests set status='cancelled',updated_at=now() where id=r.id;
 if r.org_id is not null then insert into public.organization_events(org_id,actor_id,event_type,details)
 values(r.org_id,auth.uid(),'data_request_cancelled',jsonb_build_object('request_id',r.id));end if;
 return true;
end $$;
revoke all on function public.catalog_cancel_data_request(uuid) from public,anon;
grant execute on function public.catalog_cancel_data_request(uuid) to authenticated;

-- Source: 202611120041_personal_export.sql
-- Personal exports contain account facts and memberships, not shared company documents.
-- Archives expire by authorization even while physical deletion remains disabled.
create table solvren_private.personal_exports (
 request_id uuid primary key references public.catalog_data_requests(id),
 document jsonb not null,expires_at timestamptz not null
);
revoke all on solvren_private.personal_exports from public,anon,authenticated;

create function public.catalog_personal_export(request_id uuid) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare r public.catalog_data_requests; output jsonb;
begin
 select * into r from public.catalog_data_requests where id=request_id;
 if r.id is null or r.requested_by is distinct from auth.uid() or r.kind<>'personal_export' or r.status<>'completed' then
  raise exception 'Export unavailable' using errcode='42501';end if;
 -- Step up when the account has MFA, without making MFA enrollment mandatory for customers.
 if exists(select 1 from auth.mfa_factors where user_id=auth.uid() and status='verified') and coalesce(auth.jwt()->>'aal','')<>'aal2' then
  raise exception 'Authenticator verification required' using errcode='42501';end if;
 select document into output from solvren_private.personal_exports where personal_exports.request_id=r.id and expires_at>now();
 if output is null then raise exception 'Export expired; request a new copy' using errcode='22023';end if;
 return output;
end $$;
revoke all on function public.catalog_personal_export(uuid) from public,anon;
grant execute on function public.catalog_personal_export(uuid) to authenticated;

-- Source: 202611120042_organization_exports.sql
create table solvren_private.organization_export_parts (
 id uuid primary key default gen_random_uuid(),request_id uuid not null references public.catalog_data_requests(id),
 ordinal integer not null,kind text not null check(kind in ('records','file')),
 payload jsonb not null,object_key text not null unique,
 status text not null default 'pending' check(status in ('pending','ready')),
 sha256 text,byte_size bigint,unique(request_id,ordinal)
);
revoke all on solvren_private.organization_export_parts from public,anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('catalog-exports','catalog-exports',false,52428800,array['application/zip'])
 on conflict(id) do nothing;

create function public.catalog_export_available(request_id uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.catalog_data_requests r
 where r.id=request_id and r.kind='organization_export' and r.status='completed'
 and r.completed_at>now()-interval '7 days' and r.requested_by=auth.uid()
 and public.catalog_role(r.org_id)='owner' and coalesce(auth.jwt()->>'aal','')='aal2')
$$;
revoke all on function public.catalog_export_available(uuid) from public,anon;
grant execute on function public.catalog_export_available(uuid) to authenticated;

create function public.catalog_export_index(request_id uuid) returns jsonb
 language plpgsql stable security definer set search_path='' as $$
declare output jsonb;
begin
 if not public.catalog_export_available(request_id) then raise exception 'Export unavailable, expired or access changed' using errcode='42501';end if;
 select jsonb_build_object('requestId',r.id,'completedAt',r.completed_at,'expiresAt',r.completed_at+interval '7 days',
 'format','solvren-workspace-export-v1','parts',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'ordinal',p.ordinal,'kind',p.kind,'objectKey',p.object_key,'sha256',p.sha256,'bytes',p.byte_size) order by p.ordinal)
 from solvren_private.organization_export_parts p where p.request_id=r.id and p.status='ready'),'[]'::jsonb))
 into output from public.catalog_data_requests r where r.id=request_id;
 return output;
end $$;
revoke all on function public.catalog_export_index(uuid) from public,anon;
grant execute on function public.catalog_export_index(uuid) to authenticated;
create function public.catalog_export_object_visible(object_name text) returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select 1 from solvren_private.organization_export_parts p
 where p.object_key=object_name and p.status='ready' and public.catalog_export_available(p.request_id))
$$;
revoke all on function public.catalog_export_object_visible(text) from public,anon;
grant execute on function public.catalog_export_object_visible(text) to authenticated;
create policy catalog_export_download on storage.objects for select to authenticated
 using(bucket_id='catalog-exports' and public.catalog_export_object_visible(name));

-- Source: 202611120043_export_cache_boundary.sql
-- Cached storage bytes must not grant new plaintext access after revocation.
alter table solvren_private.organization_export_parts add column encryption_key bytea;
update storage.buckets set allowed_mime_types=array['application/zip','application/octet-stream'] where id='catalog-exports';
create function public.catalog_export_key(part_id uuid) returns text
 language plpgsql stable security definer set search_path='' as $$
declare key_hex text;
begin
 select encode(p.encryption_key,'hex') into key_hex from solvren_private.organization_export_parts p
 where p.id=part_id and p.status='ready' and public.catalog_export_available(p.request_id);
 if key_hex is null then raise exception 'Export unavailable' using errcode='42501';end if;
 return key_hex;
end $$;
revoke all on function public.catalog_export_key(uuid) from public,anon;
grant execute on function public.catalog_export_key(uuid) to authenticated;
-- Fail closed for any pre-encryption snapshot; no deletion of its data occurs.
update public.catalog_data_requests r set status='blocked',blockers=array['export_format_replaced'],updated_at=now()
 where r.kind='organization_export' and r.status in ('requested','preparing','completed')
 and exists(select 1 from solvren_private.organization_export_parts p where p.request_id=r.id and p.encryption_key is null);

-- Source: 202611120044_export_retry.sql
create function public.catalog_retry_export(request_id uuid) returns boolean
 language plpgsql security definer set search_path='' as $$
declare r public.catalog_data_requests;
begin
 select * into r from public.catalog_data_requests where id=request_id for update;
 if r.id is null or r.requested_by is distinct from auth.uid() or r.kind<>'organization_export'
 or public.catalog_role(r.org_id) is distinct from 'owner' or coalesce(auth.jwt()->>'aal','')<>'aal2' then
  raise exception 'Export unavailable' using errcode='42501';end if;
 if r.status<>'failed' then raise exception 'Only failed exports may be retried' using errcode='22023';end if;
 update public.catalog_data_requests set status=case when exists(select 1 from solvren_private.organization_export_parts where organization_export_parts.request_id=r.id) then 'preparing' else 'requested' end,
 blockers='{}',updated_at=now() where id=r.id;
 insert into public.organization_events(org_id,actor_id,event_type,details)
 values(r.org_id,auth.uid(),'data_export_retried',jsonb_build_object('request_id',r.id));
 return true;
end $$;
revoke all on function public.catalog_retry_export(uuid) from public,anon;
grant execute on function public.catalog_retry_export(uuid) to authenticated;

-- Source: 202611120045_retention_preview.sql
-- Retention planning only. No DELETE grant, worker or activation flag is added.
alter table public.catalog_jobs add column retention_closed_at timestamptz;
-- Historical closure timing is not reliable: start the clock now, never infer
-- an earlier date that could shorten a customer's retention window.
update public.catalog_jobs set retention_closed_at=now() where status in ('closed','cancelled');
create function solvren_private.catalog_retention_clock() returns trigger
 language plpgsql set search_path='' as $$
begin
 if new.status in ('closed','cancelled') then
  if TG_OP='INSERT' then new.retention_closed_at:=now();
  elsif old.status not in ('closed','cancelled') then new.retention_closed_at:=now();
  else new.retention_closed_at:=old.retention_closed_at;end if;
 else new.retention_closed_at:=null;end if;
 return new;
end $$;
create trigger catalog_retention_clock before insert or update on public.catalog_jobs
 for each row execute function solvren_private.catalog_retention_clock();

create table solvren_private.retention_holds(
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id),
 job_id uuid,kind text not null check(kind in ('customer','legal','security')),
 reason text not null check(length(trim(reason)) between 1 and 2000),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 released_by uuid references auth.users(id),released_at timestamptz,
 foreign key(org_id,job_id) references public.catalog_jobs(org_id,id),
 check((released_by is null)=(released_at is null))
);
revoke all on solvren_private.retention_holds from public,anon,authenticated;
create index retention_holds_active on solvren_private.retention_holds(org_id,job_id) where released_at is null;

create function public.catalog_retention_hold(workspace uuid,command text,reason text default null,hold_id uuid default null)
 returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;h solvren_private.retention_holds;
begin
 perform 1 from public.organizations where id=workspace for update;
 if public.catalog_role(workspace) is distinct from 'owner' or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'Owner MFA required' using errcode='42501';end if;
 if command='create' then
  if length(trim(coalesce(reason,''))) not between 1 and 2000 then raise exception 'Reason required' using errcode='22023';end if;
  if (select count(*) from solvren_private.retention_holds where org_id=workspace and released_at is null)>=20 then raise exception 'Hold limit reached' using errcode='22023';end if;
  insert into solvren_private.retention_holds(org_id,kind,reason,created_by) values(workspace,'customer',reason,auth.uid()) returning id into result;
 elsif command='release' then
  select * into h from solvren_private.retention_holds where id=hold_id and org_id=workspace for update;
  if h.id is null or h.kind<>'customer' or h.created_by<>auth.uid() then raise exception 'Hold unavailable' using errcode='42501';end if;
  update solvren_private.retention_holds set released_by=auth.uid(),released_at=coalesce(released_at,now()) where id=h.id;
  result=h.id;
 else raise exception 'Invalid hold action' using errcode='22023';end if;
 insert into public.organization_events(org_id,actor_id,event_type,details)
 values(workspace,auth.uid(),'retention_hold_'||command,jsonb_build_object('hold_id',result));
 return result;
end $$;
revoke all on function public.catalog_retention_hold(uuid,text,text,uuid) from public,anon;
grant execute on function public.catalog_retention_hold(uuid,text,text,uuid) to authenticated;

create function public.catalog_retention_preview(workspace uuid,after_file uuid default null) returns jsonb
 language plpgsql stable security definer set search_path='' as $$
declare output jsonb;
begin
 if public.catalog_role(workspace) is distinct from 'owner' or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'Owner MFA required' using errcode='42501';end if;
 with candidates as (
  select f.id,f.original_name,f.state,j.retention_closed_at,
   (f.purpose='delivery' or exists(select 1 from public.catalog_runs r
     join public.catalog_deliveries d on d.file_id=r.output_file_id
     join public.delivery_decisions x on x.delivery_id=d.id and x.decision='released'
     where r.org_id=workspace and (r.input_file_id=f.id or r.baseline_file_id=f.id or exists(select 1 from public.catalog_resolutions v where v.run_id=r.id and v.evidence_file_id=f.id)))) as evidence,
   exists(select 1 from solvren_private.retention_holds h where h.org_id=workspace and h.released_at is null and (h.job_id is null or h.job_id=f.job_id)) as held
  from public.source_files f join public.catalog_jobs j on j.id=f.job_id
  where f.org_id=workspace and (after_file is null or f.id>after_file) order by f.id limit 101
 ), display as (
  select id,original_name,state,held,case when evidence then 'delivery_or_evidence_12_months' else 'source_90_days' end policy,
   retention_closed_at+case when evidence then interval '12 months' else interval '90 days' end eligible_after
  from candidates order by id limit 100
 ) select jsonb_build_object('deletionEnabled',false,'policyVersion','retention-v0.1',
 'notice','Dates are planning dates, not deletion promises. Holds, notices, backup verification and safety gates must pass; deletion is inactive.',
 'files',coalesce((select jsonb_agg(to_jsonb(d) order by d.id) from display d),'[]'::jsonb),
 'hasMore',(select count(*)>100 from candidates),
 'holds',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'kind',h.kind,'createdAt',h.created_at,'canRelease',h.kind='customer' and h.created_by=auth.uid())) from solvren_private.retention_holds h where h.org_id=workspace and h.released_at is null),'[]'::jsonb)) into output;
 return output;
end $$;
revoke all on function public.catalog_retention_preview(uuid,uuid) from public,anon;
grant execute on function public.catalog_retention_preview(uuid,uuid) to authenticated;

-- Source: 202611120046_trigger_privileges.sql
-- Trigger execution is attached to the tables; no browser role needs an
-- explicit EXECUTE grant on the underlying SECURITY DEFINER trigger function.
revoke all on function public.catalog_funding_guard() from public,anon,authenticated;

-- Source: 202611120047_catalog_claims.sql
alter table public.catalog_jobs add column execution_epoch bigint not null default 0;
alter table public.catalog_runs add column claim_token uuid;
alter table public.catalog_runs add column claim_epoch bigint;
alter table public.catalog_runs add column claim_operator uuid references auth.users(id);
alter table public.catalog_runs add column lease_expires_at timestamptz;

create function solvren_private.invalidate_catalog_assignment() returns trigger
 language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 target:=case when TG_OP='DELETE' then old.job_id else new.job_id end;
 update public.catalog_jobs set execution_epoch=execution_epoch+1 where id=target;
 update public.catalog_runs set state='failed',claim_token=null,lease_expires_at=null,
 diagnostic='Assignment changed; inspect checkpoint and retry with current coverage'
 where job_id=target and state='running';
 if TG_OP='DELETE' then return old;else return new;end if;
end $$;
revoke all on function solvren_private.invalidate_catalog_assignment() from public,anon,authenticated;
create trigger catalog_assignment_fence after insert or update or delete on solvren_private.staff_assignments
 for each row execute function solvren_private.invalidate_catalog_assignment();

create function solvren_private.claim_catalog_run() returns public.catalog_runs
 language plpgsql set search_path='' as $$
declare r public.catalog_runs; epoch bigint; operator_id uuid;
begin
 update public.catalog_runs set state='failed',claim_token=null,lease_expires_at=null,
 diagnostic='Execution lease expired; safe checkpoint retained'
 where state='running' and (lease_expires_at is null or lease_expires_at<=clock_timestamp());
 select run.* into r from public.catalog_runs run join public.catalog_jobs j on j.id=run.job_id
 where run.state='queued' and run.attempts<3 and j.status in ('processing','quality_review')
 and run.profile_version_id=j.profile_version_id and public.catalog_current_funding(j.id)
 and exists(select 1 from solvren_private.staff_assignments a join solvren_private.staff_members s on s.user_id=a.user_id and s.enabled
  join solvren_private.operator_allowlist l on l.user_id=s.user_id and l.enabled where a.job_id=j.id)
 order by run.created_at,run.id for update of j,run skip locked limit 1;
 if r.id is null then return null;end if;
 select execution_epoch into epoch from public.catalog_jobs where id=r.job_id;
 select a.user_id into operator_id from solvren_private.staff_assignments a
 join solvren_private.staff_members s on s.user_id=a.user_id and s.enabled
 join solvren_private.operator_allowlist l on l.user_id=s.user_id and l.enabled
 where a.job_id=r.job_id order by a.user_id limit 1;
 update public.catalog_runs set state='running',started_at=clock_timestamp(),attempts=attempts+1,
 claim_token=gen_random_uuid(),claim_epoch=epoch,claim_operator=operator_id,lease_expires_at=clock_timestamp()+interval '5 minutes'
 where id=r.id returning * into r;
 return r;
end $$;
revoke all on function solvren_private.claim_catalog_run() from public,anon,authenticated;

create function solvren_private.assert_catalog_claim(run_id uuid,token uuid) returns boolean
 language plpgsql set search_path='' as $$
declare r public.catalog_runs;j public.catalog_jobs;
begin
 select jobs.* into j from public.catalog_jobs jobs join public.catalog_runs runs on runs.job_id=jobs.id where runs.id=run_id for update of jobs;
 select * into r from public.catalog_runs where id=run_id for update;
 if r.id is null or r.state<>'running' or token is null or r.claim_token is distinct from token
 or r.lease_expires_at<=clock_timestamp() or r.lease_expires_at is null
 or r.claim_epoch is distinct from j.execution_epoch or j.status not in ('processing','quality_review')
 or r.profile_version_id is distinct from j.profile_version_id or not public.catalog_current_funding(j.id)
 or not exists(select 1 from solvren_private.staff_assignments a join solvren_private.staff_members s on s.user_id=a.user_id and s.enabled
 join solvren_private.operator_allowlist l on l.user_id=s.user_id and l.enabled
 where a.job_id=j.id and a.user_id=r.claim_operator) then
  raise exception 'Execution claim expired or work authority changed' using errcode='40001';
 end if;
 return true;
end $$;
revoke all on function solvren_private.assert_catalog_claim(uuid,uuid) from public,anon,authenticated;

create function solvren_private.catalog_run_checkpoint(run_id uuid,token uuid,command text,payload jsonb default null) returns boolean
 language plpgsql set search_path='' as $$
begin
 if command='failed' then
  update public.catalog_runs set state='failed',diagnostic=left(coalesce(payload->>'message','Processing failed'),500),claim_token=null,lease_expires_at=null
  where id=run_id and state='running' and claim_token=token and token is not null;
  return found;
 end if;
 perform solvren_private.assert_catalog_claim(run_id,token);
 if command='validated' then
  update public.catalog_runs set result=payload,checkpoint='validated',lease_expires_at=clock_timestamp()+interval '5 minutes' where id=run_id;
 elsif command='blocked' then
  update public.catalog_runs set state='blocked',completed_at=clock_timestamp(),diagnostic='Critical exceptions require resolution',claim_token=null,lease_expires_at=null where id=run_id;
 elsif command='exported' then
  update public.catalog_runs set state='review',checkpoint='exported',completed_at=clock_timestamp(),diagnostic=null,claim_token=null,lease_expires_at=null where id=run_id;
 else raise exception 'Unsupported execution checkpoint' using errcode='22023';end if;
 return true;
end $$;
revoke all on function solvren_private.catalog_run_checkpoint(uuid,uuid,text,jsonb) from public,anon,authenticated;

-- Source: 202611120048_checkout_supersession.sql
alter table public.billing_orders add column commercial_exception text
 check(commercial_exception is null or commercial_exception in ('stale_quote_paid'));
-- Do not erase an existing business exception when a provider outage changes
-- last_error. Operational reconciliation errors are a separate state.
update public.billing_orders set commercial_exception='stale_quote_paid' where last_error='stale_quote_paid';
create function solvren_private.supersede_catalog_checkout() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 update public.billing_orders b set checkout_url=null,last_error='quote_superseded',updated_at=now()
 from public.catalog_scopes s where b.scope_id=s.id and s.job_id=new.job_id
 and s.version<new.version and b.status in ('pending','checkout');
 return new;
end $$;
revoke all on function solvren_private.supersede_catalog_checkout() from public,anon,authenticated;
create trigger supersede_catalog_checkout after insert on public.catalog_scopes
 for each row execute function solvren_private.supersede_catalog_checkout();

create or replace function public.catalog_current_funding(target_job uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.billing_orders b join public.catalog_scopes s on s.id=b.scope_id where s.job_id=target_job
 and (b.commercial_exception is not null or b.status in ('refunded','disputed') or (b.status='paid' and (b.last_error is not null or b.reconciled_at<now()-interval '5 minutes'))))
 and not exists(select 1 from public.capacity_usage u left join solvren_private.capacity_periods p on p.invoice_id=u.period_id and p.agreement_id=u.agreement_id where u.job_id=target_job and (p.invoice_id is null or not p.paid or p.checked_at<now()-interval '5 minutes'))
 and not exists(select 1 from public.billing_refunds r join public.billing_orders b on b.id=r.order_id join public.catalog_scopes s on s.id=b.scope_id where s.job_id=target_job and r.status in ('pending','uncertain'))
$$;

-- Source: 202611120049_checkout_exception_guard.sql
alter function public.catalog_checkout(uuid) set schema solvren_private;
revoke all on function solvren_private.catalog_checkout(uuid) from public,anon,authenticated;
create function public.catalog_checkout(target_scope uuid) returns uuid
 language plpgsql security definer set search_path='' as $$
declare s public.catalog_scopes;
begin
 select * into s from public.catalog_scopes where id=target_scope;
 if s.id is null or public.catalog_role(s.org_id) is distinct from 'owner' then
  raise exception 'Workspace owner required' using errcode='42501';end if;
 perform 1 from public.catalog_jobs where id=s.job_id for update;
 if exists(select 1 from public.billing_orders b join public.catalog_scopes q on q.id=b.scope_id
  where q.job_id=s.job_id and (b.commercial_exception is not null or b.status in ('refunded','disputed')))
 or exists(select 1 from public.billing_refunds r join public.billing_orders b on b.id=r.order_id
  join public.catalog_scopes q on q.id=b.scope_id where q.job_id=s.job_id and r.status in ('pending','uncertain')) then
  raise exception 'Resolve the existing payment exception before another checkout' using errcode='22023';end if;
 return solvren_private.catalog_checkout(target_scope);
end $$;
revoke all on function public.catalog_checkout(uuid) from public,anon;
grant execute on function public.catalog_checkout(uuid) to authenticated;

-- Source: 202611120050_billing_observations.sql
drop policy billing_read on public.billing_orders;
create policy billing_read on public.billing_orders for select to authenticated
 using(public.catalog_role(org_id)='owner' or public.catalog_manager_access());

create table public.billing_observations(
 observation_key text primary key check(observation_key~'^[a-f0-9]{64}$'),
 order_id uuid not null references public.billing_orders(id),
 observed_at timestamptz not null default now(),
 provider text not null check(provider='stripe-test'),
 payment_intent_id text not null,charge_id text not null,
 gross_cents bigint not null check(gross_cents>0),refunded_cents bigint not null check(refunded_cents between 0 and gross_cents),
 disputed boolean not null,commercial_exception text
);
alter table public.billing_observations enable row level security;
revoke all on public.billing_observations from public,anon,authenticated;
grant select on public.billing_observations to authenticated;
create policy billing_observations_read on public.billing_observations for select to authenticated
 using(exists(select 1 from public.billing_orders b where b.id=order_id));
create function solvren_private.preserve_billing_observation() returns trigger
 language plpgsql set search_path='' as $$
begin raise exception 'Payment observations are append-only' using errcode='22023';end $$;
revoke all on function solvren_private.preserve_billing_observation() from public,anon,authenticated;
create trigger preserve_billing_observation before update on public.billing_observations
 for each row execute function solvren_private.preserve_billing_observation();

-- Source: 202611120051_commercial_dispositions.sql
alter table public.billing_orders add column entitlement_scope_id uuid references public.catalog_scopes(id);
alter table public.billing_orders add column resolved_refunded_cents bigint;
create table public.commercial_dispositions(
 id uuid primary key,order_id uuid not null references public.billing_orders(id),job_id uuid not null references public.catalog_jobs(id),
 target_scope_id uuid references public.catalog_scopes(id),
 action text not null check(action in ('credit_to_scope','cancel_after_refund')),
 reason text not null check(length(trim(reason)) between 1 and 4000),
 refunded_cents bigint not null,net_cents bigint not null,
 status text not null default 'proposed' check(status in ('proposed','approved','rejected','superseded')),
 proposed_by uuid not null references auth.users(id),proposed_at timestamptz not null default now(),
 decided_by uuid references auth.users(id),decided_at timestamptz
);
create unique index commercial_disposition_pending on public.commercial_dispositions(order_id) where status='proposed';
alter table public.commercial_dispositions enable row level security;
revoke all on public.commercial_dispositions from public,anon,authenticated;
grant select on public.commercial_dispositions to authenticated;
create policy disposition_read on public.commercial_dispositions for select to authenticated
 using(exists(select 1 from public.catalog_jobs j where j.id=job_id and
 (public.catalog_role(j.org_id)='owner' or (public.catalog_manager_access() and public.catalog_staff_access(j.id)))));

create function public.catalog_propose_disposition(request_id uuid,target_order uuid,target_scope uuid,disposition_action text,explanation text) returns uuid
 language plpgsql security definer set search_path='' as $$
declare b public.billing_orders;j public.catalog_jobs;s public.catalog_scopes;net bigint;existing public.commercial_dispositions;
begin
 select jobs.* into j from public.catalog_jobs jobs join public.catalog_scopes q on q.job_id=jobs.id
 join public.billing_orders orders on orders.scope_id=q.id where orders.id=target_order for update of jobs;
 if j.id is null or not public.catalog_manager_access() or not public.catalog_staff_access(j.id) then raise exception 'Assigned manager MFA required' using errcode='42501';end if;
 select * into b from public.billing_orders where id=target_order for update;
 select * into existing from public.commercial_dispositions where id=request_id;
 if existing.id is not null then
  if existing.order_id<>target_order or existing.target_scope_id is distinct from target_scope or existing.action<>disposition_action or existing.reason<>explanation then raise exception 'Request identifier already used' using errcode='22023';end if;
  return existing.id;
 end if;
 if b.status not in ('paid','refunded') or b.stripe_payment_intent is null or b.last_error is not null
 or b.reconciled_at is null or b.reconciled_at<now()-interval '5 minutes'
 or exists(select 1 from public.billing_refunds where order_id=b.id and status in ('pending','uncertain')) then raise exception 'Fresh settled payment and refund reconciliation required' using errcode='22023';end if;
 net:=b.amount_cents-b.refunded_cents;
 if disposition_action='credit_to_scope' then
  select * into s from public.catalog_scopes where id=target_scope and job_id=j.id;
  if s.id is null or s.id is distinct from (select id from public.catalog_scopes where job_id=j.id order by version desc limit 1)
  or not exists(select 1 from public.scope_approvals where scope_id=s.id) or s.price_cents<>net or net<=0 then
   raise exception 'Latest approved quote must exactly match retained payment' using errcode='22023';end if;
 elsif disposition_action='cancel_after_refund' then
  if net<>0 or target_scope is not null then raise exception 'Confirmed full refund required before cancellation' using errcode='22023';end if;
 else raise exception 'Unsupported disposition' using errcode='22023';end if;
 if j.status in ('accepted','closed','cancelled') then raise exception 'Closed work cannot be rewritten' using errcode='22023';end if;
 update public.commercial_dispositions set status='superseded' where order_id=b.id and status='proposed';
 insert into public.commercial_dispositions(id,order_id,job_id,target_scope_id,action,reason,refunded_cents,net_cents,proposed_by)
 values(request_id,b.id,j.id,target_scope,disposition_action,explanation,b.refunded_cents,net,auth.uid());
 insert into public.job_events(org_id,job_id,actor_id,event_type,revision,details)
 values(j.org_id,j.id,auth.uid(),'commercial_disposition_proposed:'||request_id,j.revision,jsonb_build_object('disposition_id',request_id));
 return request_id;
end $$;
revoke all on function public.catalog_propose_disposition(uuid,uuid,uuid,text,text) from public,anon;
grant execute on function public.catalog_propose_disposition(uuid,uuid,uuid,text,text) to authenticated;

create function public.catalog_decide_disposition(disposition_id uuid,approve boolean) returns boolean
 language plpgsql security definer set search_path='' as $$
declare d public.commercial_dispositions;j public.catalog_jobs;b public.billing_orders;s public.catalog_scopes;projection_count integer;
begin
 select jobs.* into j from public.catalog_jobs jobs join public.commercial_dispositions x on x.job_id=jobs.id where x.id=disposition_id for update of jobs;
 if j.id is null or public.catalog_role(j.org_id) is distinct from 'owner' or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'Workspace owner MFA required' using errcode='42501';end if;
 select * into d from public.commercial_dispositions where id=disposition_id for update;
 if d.status<>'proposed' or approve is null then raise exception 'Current proposal required' using errcode='22023';end if;
 if approve then
  select * into b from public.billing_orders where id=d.order_id for update;
  if j.status in ('accepted','closed','cancelled') or b.status not in ('paid','refunded') or b.last_error is not null
  or b.reconciled_at is null or b.reconciled_at<now()-interval '5 minutes' or b.refunded_cents<>d.refunded_cents
  or b.amount_cents-b.refunded_cents<>d.net_cents or exists(select 1 from public.billing_refunds where order_id=b.id and status in ('pending','uncertain')) then
   raise exception 'Payment or work changed; request a new proposal' using errcode='22023';end if;
  if d.action='credit_to_scope' then
   select * into s from public.catalog_scopes where id=d.target_scope_id and job_id=j.id;
   if s.id is null or s.id is distinct from (select id from public.catalog_scopes where job_id=j.id order by version desc limit 1)
   or not exists(select 1 from public.scope_approvals where scope_id=s.id) or s.price_cents<>d.net_cents then raise exception 'Quote changed; request a new proposal' using errcode='22023';end if;
   select count(*) into projection_count from public.catalog_payments p join public.catalog_scopes q on q.id=p.scope_id
   where q.job_id=j.id and p.reference='stripe-test:'||b.stripe_payment_intent and p.amount_cents=d.net_cents;
   if projection_count<>1 then raise exception 'Reconcile payment balance before allocating credit' using errcode='22023';end if;
   update public.catalog_payments p set scope_id=s.id from public.catalog_scopes q where q.id=p.scope_id and q.job_id=j.id and p.reference='stripe-test:'||b.stripe_payment_intent;
   update public.billing_orders set entitlement_scope_id=s.id,resolved_refunded_cents=refunded_cents,commercial_exception=null where id=b.id;
   -- A financial decision resolves funding, but does not silently resume work.
   -- The normal authorized lifecycle/resume action still checks all other holds.
  else
   if d.net_cents<>0 then raise exception 'Full refund required' using errcode='22023';end if;
   update public.catalog_jobs set status='cancelled',hold_reason=null,resume_status=null,revision=revision+1,updated_at=now() where id=j.id;
  end if;
 end if;
 update public.commercial_dispositions set status=case when approve then 'approved' else 'rejected' end,decided_by=auth.uid(),decided_at=now() where id=d.id;
 insert into public.job_events(org_id,job_id,actor_id,event_type,revision,details)
 values(j.org_id,j.id,auth.uid(),'commercial_disposition_decided:'||d.id,j.revision,jsonb_build_object('disposition_id',d.id,'approved',approve));
 return true;
end $$;
revoke all on function public.catalog_decide_disposition(uuid,boolean) from public,anon;
grant execute on function public.catalog_decide_disposition(uuid,boolean) to authenticated;

create function solvren_private.catalog_order_resolved(order_id uuid) returns boolean
 language sql stable set search_path='' as $$
 select exists(select 1 from public.billing_orders b join public.catalog_scopes s on s.id=b.entitlement_scope_id
 join public.catalog_scopes original on original.id=b.scope_id
 where b.id=order_id and b.commercial_exception is null and s.job_id=original.job_id and s.org_id=b.org_id
 and b.resolved_refunded_cents=b.refunded_cents and b.amount_cents-b.refunded_cents=s.price_cents and s.price_cents>0
 and exists(select 1 from public.scope_approvals where scope_id=s.id))
$$;
revoke all on function solvren_private.catalog_order_resolved(uuid) from public,anon,authenticated;
create or replace function public.catalog_current_funding(target_job uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.billing_orders b join public.catalog_scopes s on s.id=b.scope_id where s.job_id=target_job
 and (b.commercial_exception is not null or b.status='disputed' or (b.status='refunded' and not solvren_private.catalog_order_resolved(b.id))
 or (b.status in ('paid','refunded') and (b.last_error is not null or b.reconciled_at is null or b.reconciled_at<now()-interval '5 minutes'))))
 and not exists(select 1 from public.capacity_usage u left join solvren_private.capacity_periods p on p.invoice_id=u.period_id and p.agreement_id=u.agreement_id where u.job_id=target_job and (p.invoice_id is null or not p.paid or p.checked_at<now()-interval '5 minutes'))
 and not exists(select 1 from public.billing_refunds r join public.billing_orders b on b.id=r.order_id join public.catalog_scopes s on s.id=b.scope_id where s.job_id=target_job and r.status in ('pending','uncertain'))
$$;
create or replace function public.catalog_billing_start_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if new.status='processing' and old.status is distinct from 'processing' and not public.catalog_current_funding(new.id) then raise exception 'Billing exception requires resolution' using errcode='22023';end if;
 return new;
end $$;

-- Source: 202611120052_financial_resume.sql
-- An approved financial resolution returns work to an explicit operator restart
-- path; it never silently restarts processing or reuses an in-flight claim.
create function solvren_private.prepare_resolved_work() returns trigger
 language plpgsql set search_path='' as $$
begin
 if new.status='approved' and old.status='proposed' and new.action='credit_to_scope' then
  update public.catalog_jobs set resume_status='queued',execution_epoch=execution_epoch+1
  where id=new.job_id and status='awaiting_customer';
  update public.catalog_runs set state='failed',claim_token=null,lease_expires_at=null,
   diagnostic='Commercial scope resolved; review inputs before starting a new run'
  where job_id=new.job_id and state in ('queued','running');
 end if;
 return new;
end $$;
revoke all on function solvren_private.prepare_resolved_work() from public,anon,authenticated;
create trigger prepare_resolved_work after update on public.commercial_dispositions
 for each row execute function solvren_private.prepare_resolved_work();

alter function public.catalog_lifecycle_action(uuid,text,text) set schema solvren_private;
revoke all on function solvren_private.catalog_lifecycle_action(uuid,text,text) from public,anon,authenticated;
create function public.catalog_lifecycle_action(target_job uuid,command text,note text) returns boolean
 language plpgsql security definer set search_path='' as $$
declare j public.catalog_jobs;
begin
 if command='resume' then
  select * into j from public.catalog_jobs where id=target_job for update;
  if j.id is null or not public.catalog_staff_access(j.id) then raise exception 'Assigned MFA operator required' using errcode='42501';end if;
  if j.status<>'awaiting_customer' or j.resume_status is null or j.resume_status not in ('queued','processing','quality_review')
  or note is null or length(trim(note)) not between 1 and 2000 or not public.catalog_current_funding(j.id) then
   raise exception 'Resolve holds and record a restart reason first' using errcode='22023';end if;
  if j.resume_status='queued' then
   update public.catalog_jobs set status='queued',resume_status=null,hold_reason=null,revision=revision+1,updated_at=now() where id=j.id;
   insert into public.job_events(org_id,job_id,actor_id,event_type,revision,details)
   values(j.org_id,j.id,auth.uid(),'lifecycle_resume:'||gen_random_uuid(),j.revision,jsonb_build_object('reason',note,'next','queued'));
   return true;
  end if;
 end if;
 return solvren_private.catalog_lifecycle_action(target_job,command,note);
end $$;
revoke all on function public.catalog_lifecycle_action(uuid,text,text) from public,anon;
grant execute on function public.catalog_lifecycle_action(uuid,text,text) to authenticated;

-- Source: 202611120053_held_quotes.sql
-- Revise the commercial agreement without dropping the production hold.
create or replace function public.catalog_service_action(target_job uuid,command text,payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare j public.catalog_jobs;s public.catalog_scopes;result uuid;
begin
 if command='payment' and not public.catalog_manager_access() then
  raise exception 'Manager MFA required to record money' using errcode='42501';
 end if;
 if command in ('quote','approve') then
  select * into j from public.catalog_jobs where id=target_job for update;
  if j.status='awaiting_customer' then
   if not exists(select 1 from public.billing_orders b join public.catalog_scopes q on q.id=b.scope_id
    where q.job_id=j.id and (b.commercial_exception is not null or b.refunded_cents>0)) then
    raise exception 'Financial exception required for a held quote' using errcode='22023';
   end if;
   select * into s from public.catalog_scopes where job_id=j.id order by version desc limit 1;
   if command='quote' then
    if not public.catalog_manager_access() or not public.catalog_staff_access(j.id) then
     raise exception 'Assigned MFA manager required' using errcode='42501';end if;
    insert into public.catalog_scopes(org_id,job_id,version,description,acceptance,exclusions,price_cents,currency,created_by)
    values(j.org_id,j.id,coalesce(s.version,0)+1,payload->>'description',payload->>'acceptance',coalesce(payload->>'exclusions',''),(payload->>'price_cents')::bigint,'USD',auth.uid()) returning id into result;
   else
    if public.catalog_role(j.org_id) is distinct from 'owner' or auth.jwt()->>'aal' is distinct from 'aal2'
     or s.id is distinct from (payload->>'scope_id')::uuid or payload->>'approve_spend' is distinct from 'true' then
     raise exception 'MFA owner approval of current quote required' using errcode='42501';end if;
    insert into public.scope_approvals values(s.id,auth.uid(),now()) on conflict do nothing;result:=s.id;
   end if;
   update public.catalog_jobs set revision=revision+1,updated_at=now() where id=j.id;
   insert into public.job_events(org_id,job_id,actor_id,event_type,revision,details)
   values(j.org_id,j.id,auth.uid(),command||':'||result,j.revision,jsonb_build_object('entity_id',result,'hold_preserved',true)) on conflict do nothing;
   return result;
  end if;
 end if;
 return solvren_private.catalog_service_action(target_job,command,payload);
end $$;
revoke all on function public.catalog_service_action(uuid,text,jsonb) from public,anon;
grant execute on function public.catalog_service_action(uuid,text,jsonb) to authenticated;

-- Source: 202611120054_run_scope_binding.sql
alter table public.catalog_runs add column accepted_scope_id uuid references public.catalog_scopes(id);
alter table public.catalog_runs add column scope_bound boolean not null default false;

create function solvren_private.bind_run_scope() returns trigger language plpgsql set search_path='' as $$
declare latest uuid;
begin
 perform 1 from public.catalog_jobs where id=new.job_id for update;
 select id into latest from public.catalog_scopes where job_id=new.job_id order by version desc limit 1;
 if TG_OP='INSERT' then
  if latest is not null and not exists(select 1 from public.scope_approvals where scope_id=latest) then
   raise exception 'Approve the current scope before creating a run' using errcode='22023';end if;
  new.accepted_scope_id:=latest;new.scope_bound:=true;
 else
  if new.accepted_scope_id is distinct from old.accepted_scope_id or new.scope_bound is distinct from old.scope_bound then
   raise exception 'Run scope is immutable; create a new run' using errcode='22023';end if;
  if new.state in ('queued','running','review') and (not new.scope_bound or new.accepted_scope_id is distinct from latest) then
   raise exception 'Run belongs to an earlier scope; create a new run' using errcode='22023';end if;
 end if;
 return new;
end $$;
revoke all on function solvren_private.bind_run_scope() from public,anon,authenticated;
create trigger bind_run_scope before insert or update on public.catalog_runs for each row execute function solvren_private.bind_run_scope();

-- Existing runs have no provable accepted-scope snapshot; preserve their evidence,
-- but do not allow their checkpoints to be reused for new production work.
update public.catalog_runs set state='failed',claim_token=null,lease_expires_at=null,
 diagnostic='Historical run lacks a verified scope binding; create a new run'
 where state in ('queued','running','review','blocked');

create function solvren_private.invalidate_runs_on_quote() returns trigger language plpgsql set search_path='' as $$
begin
 update public.catalog_jobs set execution_epoch=execution_epoch+1 where id=new.job_id;
 update public.catalog_runs set state='failed',claim_token=null,lease_expires_at=null,
  diagnostic='Quote changed; create a new run for the newly approved scope'
 where job_id=new.job_id and state in ('queued','running','review','blocked');
 return new;
end $$;
revoke all on function solvren_private.invalidate_runs_on_quote() from public,anon,authenticated;
create trigger invalidate_runs_on_quote after insert on public.catalog_scopes for each row execute function solvren_private.invalidate_runs_on_quote();

-- Source: 202611120055_notification_claims.sql
alter table solvren_private.notification_outbox add column claim_token uuid;
alter table solvren_private.service_outbox add column claim_token uuid;
alter table solvren_private.service_outbox add column recipient_id uuid references auth.users(id);

-- Support notices bind to an identity at creation, never to whoever later owns
-- the same mailbox. Invitation notices remain addressed to the invited mailbox.
create function solvren_private.bind_service_recipient() returns trigger language plpgsql set search_path='' as $$
begin
 if new.case_id is not null then
  select u.id into new.recipient_id from auth.users u join public.service_cases c on c.id=new.case_id
  where lower(u.email)=lower(new.recipient) and (u.id=c.created_by or u.id=c.assigned_to);
  if new.recipient_id is null then raise exception 'Case recipient identity unavailable' using errcode='22023';end if;
 end if;
 return new;
end $$;
revoke all on function solvren_private.bind_service_recipient() from public,anon,authenticated;
create trigger bind_service_recipient before insert on solvren_private.service_outbox for each row execute function solvren_private.bind_service_recipient();

-- Source: 202611120056_worker_readiness.sql
create table solvren_private.worker_readiness(
 worker text primary key check(worker in ('process-data-requests','update-signatures','scan-files','process-catalog','process-refunds','process-billing','process-capacity','send-notifications','send-service-notifications')),
 expected boolean not null default false,interval_seconds integer not null check(interval_seconds between 30 and 86400),
 timeout_seconds integer not null check(timeout_seconds between 1 and 3600),
 invocation_id uuid,state text not null default 'inactive' check(state in ('inactive','running','completed','failed','timeout')),
 started_at timestamptz,finished_at timestamptz,last_success_at timestamptz
);
revoke all on solvren_private.worker_readiness from public,anon,authenticated;
insert into solvren_private.worker_readiness(worker,interval_seconds,timeout_seconds) values
 ('process-data-requests',30,120),('update-signatures',21600,600),('scan-files',30,180),
 ('process-catalog',30,300),('process-refunds',30,300),('process-billing',30,300),
 ('process-capacity',30,300),('send-notifications',30,300),('send-service-notifications',30,300);

create function public.catalog_worker_readiness() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.catalog_desk_access() then raise exception 'Support MFA required' using errcode='42501';end if;
 return jsonb_build_object('checked_at',now(),'workers',(
  select jsonb_agg(jsonb_build_object('name',worker,'expected',expected,'state',state,'started_at',started_at,
   'finished_at',finished_at,'last_success_at',last_success_at,'health',case
    when not expected then 'inactive'
    when started_at is null then 'missing'
    when state='running' and started_at<now()-make_interval(secs=>timeout_seconds+30) then 'overdue'
    when state in ('failed','timeout') then 'failed'
    when state<>'running' and finished_at<now()-make_interval(secs=>3*interval_seconds) then 'missing'
    when last_success_at is null then 'unverified'
    else 'current' end) order by worker) from solvren_private.worker_readiness),
  'expired_catalog_claims',(select count(*) from public.catalog_runs where state='running' and (lease_expires_at is null or lease_expires_at<now())),
  'uncertain_notifications',(select count(*) from solvren_private.notification_outbox where state='uncertain')+(select count(*) from solvren_private.service_outbox where state='uncertain'),
  'external_alert_verified',false,'restore_verified',false);
end $$;
revoke all on function public.catalog_worker_readiness() from public,anon;
grant execute on function public.catalog_worker_readiness() to authenticated;

-- Source: 202611120057_scan_claims.sql
alter table public.source_files add column scan_claim_token uuid;
alter table public.source_files add column scan_lease_expires_at timestamptz;

-- Source: 202611120058_notification_review.sql
create table solvren_private.notification_reviews(
 id uuid primary key default gen_random_uuid(),queue text not null check(queue in ('job','service')),
 notification_id uuid not null,actor_id uuid not null references auth.users(id),
 action text not null check(action in ('acknowledge','retry')),note text not null check(length(trim(note)) between 1 and 2000),
 created_at timestamptz not null default now()
);
revoke all on solvren_private.notification_reviews from public,anon,authenticated;

create function public.catalog_notification_queue(before_time timestamptz default null,before_id uuid default null,before_queue text default null)
 returns jsonb language plpgsql stable security definer set search_path='' as $$
declare output jsonb;
begin
 if not public.catalog_desk_access() then raise exception 'Support MFA required' using errcode='42501';end if;
 if (before_time is null)::int+(before_id is null)::int+(before_queue is null)::int not in (0,3)
 or before_queue is not null and before_queue not in ('job','service') then raise exception 'Invalid cursor' using errcode='22023';end if;
 with items as (
  select n.id,'job'::text queue,n.state,n.last_error,n.attempts,e.created_at from solvren_private.notification_outbox n join public.job_events e on e.id=n.event_id where n.state in ('failed','uncertain')
  union all select id,'service',state,last_error,attempts,created_at from solvren_private.service_outbox where state in ('failed','uncertain')
 ), selected as (
  select * from items where before_time is null or (created_at,id,queue)<(before_time,before_id,before_queue)
  order by created_at desc,id desc,queue desc limit 51
 ) select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'queue',s.queue,'state',s.state,'error',s.last_error,'attempts',s.attempts,'created_at',s.created_at,
  'last_review',(select jsonb_build_object('action',r.action,'note',r.note,'created_at',r.created_at) from solvren_private.notification_reviews r where r.queue=s.queue and r.notification_id=s.id order by r.created_at desc,r.id desc limit 1)) order by s.created_at desc,s.id desc,s.queue desc) from (select * from selected order by created_at desc,id desc,queue desc limit 50) s),'[]'::jsonb),'has_more',(select count(*)>50 from selected)) into output;
 return output;
end $$;
revoke all on function public.catalog_notification_queue(timestamptz,uuid,text) from public,anon;
grant execute on function public.catalog_notification_queue(timestamptz,uuid,text) to authenticated;

create function public.catalog_review_notification(target_queue text,target_id uuid,command text,explanation text)
 returns boolean language plpgsql security definer set search_path='' as $$
declare current_state text;failure text;tries integer;
begin
 if not public.catalog_desk_access() then raise exception 'Support MFA required' using errcode='42501';end if;
 if target_queue not in ('job','service') or command not in ('acknowledge','retry') or explanation is null or length(trim(explanation)) not between 1 and 2000 then raise exception 'Review details required' using errcode='22023';end if;
 if target_queue='job' then select state,last_error,attempts into current_state,failure,tries from solvren_private.notification_outbox where id=target_id for update;
 else select state,last_error,attempts into current_state,failure,tries from solvren_private.service_outbox where id=target_id for update;end if;
 if current_state is null or current_state not in ('failed','uncertain') then raise exception 'Current attention item required' using errcode='22023';end if;
 if command='retry' then
  if current_state<>'failed' or failure is distinct from 'smtp_rejected_before_acceptance'
   or (select count(*) from solvren_private.notification_reviews where queue=target_queue and notification_id=target_id and action='retry')>=2 then raise exception 'Only explicit SMTP rejection can be retried, at most twice; uncertain delivery cannot be resent' using errcode='22023';end if;
  -- Service messages may contain invitation credentials and are intentionally
  -- erased after terminal failures. Regenerate an invitation through its normal
  -- authorized flow instead of pretending that its body can be recovered.
  if target_queue='service' then raise exception 'Create a fresh authorized service notification; its body was cleared' using errcode='22023';end if;
  update solvren_private.notification_outbox set state='pending',attempts=0,started_at=null,next_attempt_at=now(),claim_token=null,last_error=null where id=target_id;
 end if;
 insert into solvren_private.notification_reviews(queue,notification_id,actor_id,action,note) values(target_queue,target_id,auth.uid(),command,explanation);
 return true;
end $$;
revoke all on function public.catalog_review_notification(text,uuid,text,text) from public,anon;
grant execute on function public.catalog_review_notification(text,uuid,text,text) to authenticated;

-- Source: 202611120059_current_sessions.sql
-- JWT signature validity alone does not establish that a session still exists.
create function public.catalog_session_active(require_mfa boolean default false) returns boolean
 language plpgsql stable security definer set search_path='' as $$
declare session_id text:=auth.jwt()->>'session_id';
begin
 if auth.uid() is null or session_id is null or session_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false;end if;
 return exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
  where s.id=session_id::uuid and s.user_id=auth.uid() and u.email_confirmed_at is not null
  and (u.banned_until is null or u.banned_until<=now()) and (s.not_after is null or s.not_after>now())
  and (coalesce(auth.jwt()->>'aal','')<>'aal2' or (s.aal='aal2' and exists(select 1 from auth.mfa_factors f where f.user_id=u.id and f.status='verified')))
  and (not require_mfa or (auth.jwt()->>'aal'='aal2' and s.aal='aal2'
   and exists(select 1 from auth.mfa_factors f where f.user_id=u.id and f.status='verified'))));
end $$;
revoke all on function public.catalog_session_active(boolean) from public,anon;
grant execute on function public.catalog_session_active(boolean) to authenticated;

create or replace function public.catalog_role(target_org uuid) returns text
 language sql stable security definer set search_path='' as $$
 select m.role from public.memberships m where m.org_id=target_org and m.user_id=auth.uid() and public.catalog_session_active()
$$;

-- Preserve existing capability rules and add a current provider-session gate.
do $$declare item record;definition text;body text;replacement text;begin
 for item in select p.oid,p.proname,p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('catalog_staff_access','catalog_manager_access','catalog_desk_access','catalog_operator_eligible') loop
  definition:=pg_get_functiondef(item.oid);
  body:=regexp_replace(trim(item.prosrc),'^select\s+','','i');body:=regexp_replace(body,';\s*$','');
  replacement:='select public.catalog_session_active('||case when item.proname='catalog_operator_eligible' then 'false' else 'true' end||') and ('||body||')';
  execute replace(definition,item.prosrc,replacement);
 end loop;
 -- RPCs are SECURITY DEFINER and bypass table RLS, so guard their entry too.
 for item in select p.oid,p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
  where n.nspname='public' and p.prosecdef and l.lanname='plpgsql' and p.prorettype<>'trigger'::regtype
  and p.proname<>'catalog_session_active' and (p.proname like 'catalog_%' or p.proname like '%_catalog_%') loop
  if item.prosrc !~* '\mbegin\M' then raise exception 'RPC body requires explicit session-guard review';end if;
  replacement:=regexp_replace(item.prosrc,'\mbegin\M',E'begin\n if not public.catalog_session_active() then raise exception ''Current authenticated session required'' using errcode=''42501'';end if;','i');
  execute replace(pg_get_functiondef(item.oid),item.prosrc,replacement);
 end loop;
end $$;

-- Direct table and storage requests must reject revoked sessions as well.
do $$declare item record;begin
 for item in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where c.relkind='r' and c.relrowsecurity and (n.nspname='public' or n.nspname='storage' and c.relname='objects') loop
  execute format('create policy catalog_current_session on %I.%I as restrictive for all to authenticated using (public.catalog_session_active()) with check (public.catalog_session_active())',item.nspname,item.relname);
 end loop;
end $$;

-- Source: 202611120060_session_policy_plans.sql
-- One current-session probe per direct-table statement, rather than one per row.
do $$declare item record;begin
 for item in select schemaname,tablename from pg_policies where policyname='catalog_current_session' loop
  execute format('alter policy catalog_current_session on %I.%I using ((select public.catalog_session_active())) with check ((select public.catalog_session_active()))',item.schemaname,item.tablename);
 end loop;
end $$;

-- Source: 202611120061_workload_session.sql
create or replace function public.catalog_workload() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('weekly_minutes',coalesce((select weekly_minutes from solvren_private.catalog_capacity where user_id=auth.uid()),0),'jobs',coalesce((
 select jsonb_agg(jsonb_build_object('id',j.id,'title',j.title,'status',j.status,'planned_minutes',j.planned_minutes,'logged_minutes',coalesce((select sum(minutes) from public.catalog_effort where job_id=j.id),0)))
 from public.catalog_jobs j where public.catalog_staff_access(j.id) and j.status not in ('accepted','closed','cancelled')),'[]'::jsonb))
 where public.catalog_session_active(true)
$$;

-- Source: 202611120062_staff_handoff.sql
create function public.catalog_handoff(target_job uuid,previous_operator uuid,replacement_operator uuid,reason text,next_commitment timestamptz) returns boolean
language plpgsql security definer set search_path='' as $$
declare j public.catalog_jobs; review_allowed boolean; checkpoints jsonb;
begin
 if not public.catalog_session_active() or not public.catalog_manager_access() then raise exception 'Manager MFA required' using errcode='42501';end if;
 if previous_operator=replacement_operator or reason is null or length(trim(reason)) not between 1 and 2000 or next_commitment is null or next_commitment<=clock_timestamp() or next_commitment>clock_timestamp()+interval '1 year' then raise exception 'Replacement, reason and future commitment required' using errcode='22023';end if;
 perform pg_advisory_xact_lock(110028);
 select * into j from public.catalog_jobs where id=target_job for update;
 if j.id is null or j.status in ('accepted','closed','cancelled') then raise exception 'Active job required' using errcode='22023';end if;
 select can_review into review_allowed from solvren_private.staff_assignments where job_id=j.id and user_id=previous_operator for update;
 if not found then raise exception 'Assignment changed; refresh before handoff' using errcode='40001';end if;
 if not exists(select 1 from solvren_private.staff_members s join solvren_private.operator_allowlist a on a.user_id=s.user_id and a.enabled join auth.users u on u.id=s.user_id and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=now()) where s.user_id=replacement_operator and s.enabled) then raise exception 'Active verified replacement required' using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'state',state,'claim_epoch',claim_epoch)),'[]'::jsonb) into checkpoints from public.catalog_runs where job_id=j.id;
 -- Existing assignment triggers invalidate outstanding execution authority.
 delete from solvren_private.staff_assignments where job_id=j.id and user_id=previous_operator;
 insert into solvren_private.staff_assignments(job_id,user_id,can_review) values(j.id,replacement_operator,review_allowed)
 on conflict(job_id,user_id) do update set can_review=solvren_private.staff_assignments.can_review or excluded.can_review;
 update public.catalog_jobs set next_update_at=next_commitment,revision=revision+1,updated_at=now() where id=j.id;
 insert into solvren_private.staff_audit(actor_id,action,details) values(auth.uid(),'handoff',jsonb_build_object('jobId',j.id,'previousOperator',previous_operator,'replacementOperator',replacement_operator,'reason',trim(reason),'nextCommitment',next_commitment,'previousCommitment',j.next_update_at,'checkpoints',checkpoints));
 return true;
end $$;
revoke all on function public.catalog_handoff(uuid,uuid,uuid,text,timestamptz) from public,anon;
grant execute on function public.catalog_handoff(uuid,uuid,uuid,text,timestamptz) to authenticated;

-- Source: 202611120063_recovery_evidence.sql
create table solvren_private.recovery_evidence(
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('backup','restore')),
 completed_at timestamptz not null,
 verified boolean not null default false,
 manifest_sha256 text not null check(manifest_sha256 ~ '^[a-f0-9]{64}$'),
 environment text not null check(environment in ('staging','production')),
 scope text not null check(scope in ('application_only','full_provider')),
 recorded_at timestamptz not null default now(),
 check(not verified or scope='full_provider')
);
revoke all on solvren_private.recovery_evidence from public,anon,authenticated;
create index recovery_evidence_latest on solvren_private.recovery_evidence(kind,completed_at desc) where verified;

-- Source: 202611120064_personal_export_retry.sql
alter table public.catalog_data_requests add column retry_count integer not null default 0 check(retry_count between 0 and 3);
create or replace function public.catalog_retry_export(request_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.catalog_data_requests;
begin
 if not public.catalog_session_active() then raise exception 'Active session required' using errcode='42501';end if;
 select * into r from public.catalog_data_requests where id=request_id for update;
 if r.id is null or r.requested_by is distinct from auth.uid() or r.kind not in ('personal_export','organization_export') then raise exception 'Export unavailable' using errcode='42501';end if;
 if r.kind='organization_export' and (public.catalog_role(r.org_id) is distinct from 'owner' or not public.catalog_session_active(true)) then raise exception 'Owner MFA required' using errcode='42501';end if;
 if exists(select 1 from auth.mfa_factors where user_id=auth.uid() and status='verified') and not public.catalog_session_active(true) then raise exception 'Authenticator verification required' using errcode='42501';end if;
 if r.status<>'failed' or r.retry_count>=3 then raise exception 'Retry unavailable; request operational review' using errcode='22023';end if;
 update public.catalog_data_requests set status=case when r.kind='organization_export' and exists(select 1 from solvren_private.organization_export_parts p where p.request_id=r.id) then 'preparing' else 'requested' end,
 retry_count=retry_count+1,blockers='{}',updated_at=now() where id=r.id;
 if r.org_id is not null then insert into public.organization_events(org_id,actor_id,event_type,details) values(r.org_id,auth.uid(),'data_export_retried',jsonb_build_object('request_id',r.id));end if;
 return true;
end $$;


-- Source: 202611120065_restore_containment.sql
-- Recovery containment grants no customer deletion or public recovery authority.
create table solvren_private.recovery_control (
 singleton boolean primary key default true check(singleton),
 contained boolean not null default false,
 recovery_id uuid, started_at timestamptz
);
insert into solvren_private.recovery_control(singleton) values(true);
create table solvren_private.object_tombstones (
 bucket_id text not null check(bucket_id in ('catalog-private','catalog-exports')),
 object_key text not null check(length(object_key) between 1 and 2048),
 recorded_at timestamptz not null, evidence_id uuid not null,
 primary key(bucket_id,object_key)
);
revoke all on solvren_private.recovery_control,solvren_private.object_tombstones from public,anon,authenticated;

-- Existing restrictive RLS and RPC entry guards all call this function.
do $$declare definition text;body text;begin
 select pg_get_functiondef(p.oid),p.prosrc into definition,body from pg_proc p
 join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='catalog_session_active';
 if body is null then raise exception 'Session gate missing';end if;
 execute replace(definition,body,regexp_replace(body,'\mbegin\M',E'begin\n if exists(select 1 from solvren_private.recovery_control where contained) then return false;end if;','i'));
end $$;

create function solvren_private.begin_restore(recovery uuid) returns void
 language plpgsql set search_path='' as $$
begin
 if recovery is null then raise exception 'Recovery ID required';end if;
 perform pg_advisory_xact_lock(110065);
 if exists(select 1 from solvren_private.recovery_control where contained and recovery_id=recovery) then return;end if;
 if exists(select 1 from solvren_private.recovery_control where contained) then raise exception 'Another recovery is active';end if;
 update solvren_private.recovery_control set contained=true,recovery_id=recovery,started_at=clock_timestamp();
 update public.catalog_jobs set execution_epoch=execution_epoch+1;
 update public.catalog_runs set state='failed',claim_token=null,lease_expires_at=null,
  diagnostic='Restored checkpoint requires operator review' where state in ('queued','running');
 update public.source_files set scan_claim_token=null,scan_lease_expires_at=null;
 update solvren_private.notification_outbox set state='uncertain',claim_token=null,
  last_error='restore_requires_delivery_reconciliation' where state in ('pending','sending');
 update solvren_private.service_outbox set state='uncertain',claim_token=null,body='',
  last_error='restore_requires_delivery_reconciliation' where state in ('pending','sending');
 update public.billing_refunds set status='uncertain',last_error='restore_requires_provider_reconciliation' where status='pending';
 update solvren_private.worker_readiness set expected=false,state='inactive',invocation_id=null;
end $$;
revoke all on function solvren_private.begin_restore(uuid) from public,anon,authenticated;

create function public.catalog_object_not_retired(bucket text,object_name text) returns boolean
 language sql stable security definer set search_path='' as $$
 select not exists(select 1 from solvren_private.object_tombstones where bucket_id=bucket and object_key=object_name)
$$;
revoke all on function public.catalog_object_not_retired(text,text) from public,anon;
grant execute on function public.catalog_object_not_retired(text,text) to authenticated;
create policy catalog_retired_object on storage.objects as restrictive for all to authenticated
 using(public.catalog_object_not_retired(bucket_id,name)) with check(public.catalog_object_not_retired(bucket_id,name));
create policy catalog_retired_file on public.source_files as restrictive for all to authenticated
 using(public.catalog_object_not_retired('catalog-private',object_key)) with check(public.catalog_object_not_retired('catalog-private',object_key));

create function solvren_private.reject_retired_object_write() returns trigger
 language plpgsql security definer set search_path='' as $$
declare bucket text;key text;
begin
 if TG_TABLE_SCHEMA='storage' then bucket:=new.bucket_id;key:=new.name;
 else bucket:='catalog-private';key:=new.object_key;end if;
 if exists(select 1 from solvren_private.object_tombstones where bucket_id=bucket and object_key=key) then
  raise exception 'Object is retired; restoring or recreating it is forbidden' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function solvren_private.reject_retired_object_write() from public,anon,authenticated;
create trigger catalog_no_retired_storage_write before insert or update on storage.objects
 for each row execute function solvren_private.reject_retired_object_write();
create trigger catalog_no_retired_source_write before insert or update on public.source_files
 for each row execute function solvren_private.reject_retired_object_write();
