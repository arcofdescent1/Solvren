-- Phase 3 — Seed global fail-safe policy

INSERT INTO public.policies (
  org_id,
  policy_key,
  display_name,
  description,
  scope,
  scope_ref,
  priority_order,
  status,
  default_disposition,
  rules_json
)
SELECT NULL, 'global_fail_safe', 'Global fail-safe', 'Block write actions when no other policy matches',
  'global', NULL, 1000, 'active', 'BLOCK', '[]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.policies WHERE policy_key = 'global_fail_safe' AND org_id IS NULL
);
