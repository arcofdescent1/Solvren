alter table public.margin_issues add column last_scan_id uuid;

create function public.phase3_member_picker(p_org uuid)
returns table(user_id uuid,email text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_read_org(p_org) or auth.jwt()->>'aal' <> 'aal2'
    or private.member_role_for(p_org) not in ('owner','finance','engineer')
  then raise exception 'Member access with MFA required'; end if;
  return query select m.user_id,u.email::text from public.organization_members m
    join auth.users u on u.id = m.user_id where m.org_id = p_org order by u.email;
end;
$$;

create function public.phase3_issue_action(p_org uuid,p_issue uuid,p_action text,
  p_note text default null,p_assignee uuid default null,p_snoozed_until timestamptz default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_issue public.margin_issues%rowtype; v_before jsonb;
begin
  if not private.can_read_org(p_org) or auth.jwt()->>'aal' <> 'aal2'
    or private.member_role_for(p_org) not in ('owner','finance','engineer')
  then raise exception 'Member access with MFA required'; end if;
  select * into v_issue from public.margin_issues where id = p_issue and org_id = p_org for update;
  if v_issue.id is null then raise exception 'Issue not found'; end if;
  if p_action not in ('acknowledged','commented','assigned','snoozed','unsnoozed','resolved')
  then raise exception 'Invalid issue action'; end if;
  if p_action in ('commented','resolved') and length(btrim(coalesce(p_note,''))) < 5
  then raise exception 'Add a note of at least five characters'; end if;
  if p_note is not null and length(p_note) > 2000 then raise exception 'Note is too long'; end if;
  if p_action = 'assigned' and (p_assignee is null or not exists (
    select 1 from public.organization_members where org_id = p_org and user_id = p_assignee))
  then raise exception 'Assignee must be an active member'; end if;
  if p_action = 'snoozed' and (p_snoozed_until is null or
    p_snoozed_until <= now() + interval '1 hour' or
    p_snoozed_until > now() + interval '30 days')
  then raise exception 'Snooze for one hour to thirty days'; end if;
  if v_issue.status = 'resolved' and p_action not in ('commented','assigned')
  then raise exception 'A resolved issue cannot change state until its condition recurs'; end if;
  v_before := jsonb_build_object('status',v_issue.status,'assignee',v_issue.assignee_user_id,
    'snoozed_until',v_issue.snoozed_until);
  if p_action = 'acknowledged' then
    update public.margin_issues set status = 'acknowledged',snoozed_until = null where id = p_issue;
  elsif p_action = 'assigned' then
    update public.margin_issues set assignee_user_id = p_assignee where id = p_issue;
  elsif p_action = 'snoozed' then
    update public.margin_issues set status = 'snoozed',snoozed_until = p_snoozed_until where id = p_issue;
  elsif p_action = 'unsnoozed' then
    update public.margin_issues set status = 'open',snoozed_until = null where id = p_issue;
  elsif p_action = 'resolved' then
    update public.margin_issues set status = 'resolved',resolved_at = now(),
      snoozed_until = null where id = p_issue;
  end if;
  insert into public.margin_issue_events(org_id,issue_id,event_type,actor_user_id,note,details)
    values (p_org,p_issue,p_action,auth.uid(),nullif(btrim(p_note),''),
      v_before || jsonb_build_object('new_status',(select status from public.margin_issues where id = p_issue),
        'new_assignee',(select assignee_user_id from public.margin_issues where id = p_issue),
        'new_snoozed_until',(select snoozed_until from public.margin_issues where id = p_issue)));
end;
$$;

create function public.phase3_observe_issue(p_org uuid,p_scan uuid,p_customer uuid,
  p_kind text,p_severity text,p_exposure numeric,p_evidence jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_key text; v_issue public.margin_issues%rowtype; v_event bigint; v_assignee uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if p_kind not in ('floor_breach','projected_breach','daily_spike','stale_data','reconciliation_gap')
    or p_severity not in ('material','critical') or p_scan is null
    or p_exposure is null or p_evidence is null then raise exception 'Invalid issue evidence'; end if;
  if p_kind in ('floor_breach','projected_breach','daily_spike') and p_customer is null
  then raise exception 'Customer issue requires a customer'; end if;
  v_key := coalesce(p_customer::text,'organization') || ':' || p_kind ||
    case when p_kind in ('reconciliation_gap','stale_data')
      then ':' || coalesce(p_evidence->>'provider','') else '' end;
  if length(v_key) > 240 then raise exception 'Issue key is too long'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_org::text || ':' || v_key,0));
  select * into v_issue from public.margin_issues where org_id = p_org
    and condition_key = v_key for update;
  if v_issue.id is null then
    if p_customer is not null then
      select owner_user_id into v_assignee from public.customers
        where org_id = p_org and id = p_customer;
    end if;
    if v_assignee is null then
      select user_id into v_assignee from public.organization_members
        where org_id = p_org and role = 'owner' limit 1;
    end if;
    insert into public.margin_issues(org_id,customer_id,condition_key,kind,severity,
      exposure_usd,evidence,assignee_user_id,last_scan_id)
      values (p_org,p_customer,v_key,p_kind,p_severity,p_exposure,p_evidence,v_assignee,p_scan)
      returning * into v_issue;
    insert into public.margin_issue_events(org_id,issue_id,event_type,details)
      values (p_org,v_issue.id,'detected',p_evidence) returning id into v_event;
  else
    update public.margin_issues set severity = p_severity,exposure_usd = p_exposure,
      evidence = p_evidence,last_seen_at = now(),last_scan_id = p_scan,
      signal_active = true,occurrence_count = occurrence_count + 1
      where id = v_issue.id;
    if v_issue.status = 'resolved' and not v_issue.signal_active then
      update public.margin_issues set status = 'open',resolved_at = null where id = v_issue.id;
      insert into public.margin_issue_events(org_id,issue_id,event_type,details)
        values (p_org,v_issue.id,'reopened',p_evidence) returning id into v_event;
    elsif v_issue.status = 'snoozed' and v_issue.snoozed_until <= now() then
      update public.margin_issues set status = 'open',snoozed_until = null where id = v_issue.id;
      insert into public.margin_issue_events(org_id,issue_id,event_type,details)
        values (p_org,v_issue.id,'unsnoozed',p_evidence) returning id into v_event;
    end if;
  end if;
  if v_event is not null and v_issue.assignee_user_id is not null then
    insert into public.margin_alert_deliveries(org_id,issue_id,event_id,recipient_user_id)
      values (p_org,v_issue.id,v_event,v_issue.assignee_user_id)
      on conflict (event_id,recipient_user_id) do nothing;
  end if;
  return v_issue.id;
end;
$$;

create function public.phase3_finish_issue_scan(p_org uuid,p_scan uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  update public.margin_issues set signal_active = false
    where org_id = p_org and signal_active and last_scan_id is distinct from p_scan;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.phase3_member_picker(uuid),
  public.phase3_issue_action(uuid,uuid,text,text,uuid,timestamptz),
  public.phase3_observe_issue(uuid,uuid,uuid,text,text,numeric,jsonb),
  public.phase3_finish_issue_scan(uuid,uuid) from public;
grant execute on function public.phase3_member_picker(uuid),
  public.phase3_issue_action(uuid,uuid,text,text,uuid,timestamptz) to authenticated;
grant execute on function public.phase3_observe_issue(uuid,uuid,uuid,text,text,numeric,jsonb),
  public.phase3_finish_issue_scan(uuid,uuid) to service_role;
