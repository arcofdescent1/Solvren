-- Patch 1B.2 — Slack Approve/Reject via Buttons (Schema)

-- A) notification_outbox_slack_refs — update policies for service_role inserts
drop policy if exists outbox_slack_refs_insert on public.notification_outbox_slack_refs;
drop policy if exists outbox_slack_refs_insert_service_role on public.notification_outbox_slack_refs;
create policy outbox_slack_refs_insert on public.notification_outbox_slack_refs
for insert with check (auth.role() = 'service_role');

drop policy if exists outbox_slack_refs_update on public.notification_outbox_slack_refs;
create policy outbox_slack_refs_update on public.notification_outbox_slack_refs
for update using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');


-- B) slack_action_events — consolidate to write_service for all writes
drop policy if exists slack_action_events_insert on public.slack_action_events;
drop policy if exists slack_action_events_insert_service_role on public.slack_action_events;
drop policy if exists slack_action_events_write_service on public.slack_action_events;
create policy slack_action_events_write_service on public.slack_action_events
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');


-- C) slack_user_map — add org-member policies (table from 054; may have slack_team_id)
drop policy if exists slack_user_map_select on public.slack_user_map;
create policy slack_user_map_select on public.slack_user_map
for select using (is_org_member(org_id));

drop policy if exists slack_user_map_write_org_members on public.slack_user_map;
create policy slack_user_map_write_org_members on public.slack_user_map
for insert with check (is_org_member(org_id));

drop policy if exists slack_user_map_update_org_members on public.slack_user_map;
create policy slack_user_map_update_org_members on public.slack_user_map
for update using (is_org_member(org_id)) with check (is_org_member(org_id));
