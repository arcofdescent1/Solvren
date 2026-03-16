-- Seed example approval policy: If pricing + impact > 50k, require RevOps + Finance
-- Uses first org; run after orgs exist. Idempotent: only inserts if no such policy exists.
do $$
declare
  v_org_id uuid;
  v_policy_id uuid;
begin
  select id into v_org_id from public.organizations limit 1;
  if v_org_id is null then return; end if;

  if exists (select 1 from public.approval_policies where org_id = v_org_id and name = 'Pricing over $50k') then
    return;
  end if;

  insert into public.approval_policies (org_id, name, description, priority, enabled)
  values (v_org_id, 'Pricing over $50k', 'When change_type is pricing and impact exceeds $50k, require RevOps and Finance approval.', 10, true)
  returning id into v_policy_id;

  insert into public.approval_policy_conditions (policy_id, condition_type, field, operator, value)
  values (v_policy_id, 'AND', 'change_type', 'eq', '"pricing"');

  insert into public.approval_policy_conditions (policy_id, condition_type, field, operator, value)
  values (v_policy_id, 'AND', 'impact_amount', 'gte', '50000');

  insert into public.approval_policy_roles (policy_id, required_role, min_count) values (v_policy_id, 'RevOps', 1);
  insert into public.approval_policy_roles (policy_id, required_role, min_count) values (v_policy_id, 'Finance', 1);
end $$;
