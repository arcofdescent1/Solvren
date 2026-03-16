-- Fix org_members_select RLS recursion.
-- The old policy used is_org_member(org_id), which SELECTs from organization_members,
-- triggering RLS again -> infinite recursion -> "stack depth limit exceeded".
-- Allow users to see their own membership rows directly (user_id = auth.uid()).

drop policy if exists org_members_select on organization_members;
create policy org_members_select on organization_members
  for select using (user_id = auth.uid());
