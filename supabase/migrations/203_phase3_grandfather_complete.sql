-- Phase 3 — Grandfather COMPLETED when denormalized milestone columns already satisfy exit criteria.
-- Counters are normally maintained by runPhase3Sync (GET state, mutations, nightly cron). This one-time
-- UPDATE helps orgs that accrued evidence before counters were backfilled.

UPDATE public.org_onboarding_states o
SET
  phase3_status = 'COMPLETED',
  phase3_completed_at = COALESCE(o.phase3_completed_at, now()),
  phase3_current_step = 'build_habit'
WHERE o.phase2_status = 'COMPLETED'
  AND o.phase3_status IS DISTINCT FROM 'COMPLETED'
  AND o.phase3_status IS DISTINCT FROM 'SKIPPED'
  AND COALESCE(o.expanded_integration_count, 0) >= 2
  AND COALESCE(o.active_department_count, 0) >= 3
  AND o.executive_engagement_at IS NOT NULL
  AND o.executive_engaged_user_id IS NOT NULL
  AND o.first_value_story_id IS NOT NULL
  AND COALESCE(o.phase3_usage_interaction_count, 0) >= 5
  AND COALESCE(o.phase3_active_weeks, 0) >= 2;
