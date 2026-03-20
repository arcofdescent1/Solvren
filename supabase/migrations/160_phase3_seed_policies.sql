-- Phase 3 — Seed global fail-safe policy
-- Include policy_scope, autonomy_mode, policy_rules_json for Phase 8 schema compatibility

INSERT INTO public.policies (
  org_id,
  policy_key,
  display_name,
  description,
  policy_scope,
  scope,
  scope_ref,
  scope_ref_json,
  autonomy_mode,
  policy_rules_json,
  rules_json,
  priority_order,
  status,
  default_disposition
)
SELECT NULL, 'global_fail_safe', 'Global fail-safe', 'Block write actions when no other policy matches',
  'global', 'global', NULL, '{}'::jsonb, 'manual_only', '[]'::jsonb, '[]'::jsonb,
  1000, 'active', 'BLOCK'
WHERE NOT EXISTS (
  SELECT 1 FROM public.policies WHERE policy_key = 'global_fail_safe' AND org_id IS NULL
);
