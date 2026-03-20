-- Phase 8: Seed default playbook definitions

INSERT INTO public.playbook_definitions (
  playbook_key, display_name, description, issue_family,
  detector_keys_json, entry_conditions_json, steps_json, branching_rules_json,
  required_actions_json, required_integrations_json,
  default_autonomy_mode, playbook_version, status
) VALUES
(
  'failed_payment_recovery',
  'Failed Payment Recovery',
  '1. Retry payment (auto) → 2. If fail, send outreach → 3. If fail, create task → 4. Escalate if amount high',
  'revenue',
  '["subscription-canceled-after-failed-payment"]'::jsonb,
  '{"domain": "revenue"}'::jsonb,
  '[
    {"key": "validate", "type": "decision", "order": 1},
    {"key": "retry_payment", "type": "action", "actionKey": "stripe.retry_payment", "order": 2},
    {"key": "verify_retry", "type": "verification", "order": 3},
    {"key": "billing_outreach", "type": "action", "actionKey": "stripe.update_payment_method", "condition": "on_failure", "order": 4},
    {"key": "create_task", "type": "action", "actionKey": "hubspot.create_task", "condition": "on_failure", "order": 5},
    {"key": "escalate", "type": "action", "actionKey": "slack.post_issue_summary", "condition": "on_failure", "order": 6}
  ]'::jsonb,
  '{}'::jsonb,
  '["stripe.retry_payment", "stripe.update_payment_method", "hubspot.create_task", "slack.post_issue_summary"]'::jsonb,
  '["stripe", "hubspot", "slack"]'::jsonb,
  'approve_then_execute',
  '1.0',
  'active'
),
(
  'unworked_lead_recovery',
  'Qualified Lead Rescue',
  '1. Assign owner → 2. Create task → 3. Notify → 4. Escalate if untouched after SLA',
  'revenue',
  '["opportunity-stalled"]'::jsonb,
  '{"domain": "revenue"}'::jsonb,
  '[
    {"key": "assign_owner", "type": "action", "actionKey": "hubspot.assign_owner", "order": 1},
    {"key": "create_task", "type": "action", "actionKey": "hubspot.create_task", "order": 2},
    {"key": "notify", "type": "action", "actionKey": "slack.post_issue_summary", "order": 3},
    {"key": "wait_sla", "type": "wait", "order": 4},
    {"key": "escalate", "type": "action", "actionKey": "slack.post_issue_summary", "condition": "on_no_activity", "order": 5}
  ]'::jsonb,
  '{}'::jsonb,
  '["hubspot.assign_owner", "hubspot.create_task", "slack.post_issue_summary"]'::jsonb,
  '["hubspot", "slack"]'::jsonb,
  'approve_then_execute',
  '1.0',
  'active'
)
ON CONFLICT (playbook_key, playbook_version) DO NOTHING;
