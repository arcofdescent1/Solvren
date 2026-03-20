# Phase 0 — Domain Model

## Canonical Issue Object

The issue is the core object. It supports:

- Executive summarization
- Operational queueing
- Engineering traceability
- Routing and task generation
- Change linking
- Impact tracking
- Verification and reopening

## Required Issue Fields

- `id`, `org_id`, `issue_key` (unique per org, e.g. ISS-001245)
- `source_type`, `source_ref`, `source_event_time`
- `domain_key`, `title`, `description`, `summary`
- `severity` (low | medium | high | critical)
- `status` (open | triaged | assigned | in_progress | resolved | verified | dismissed)
- `verification_status` (pending | passed | failed | not_required)
- `priority_score`, `impact_score`, `confidence_score`
- `owner_user_id`, `owner_team_key`, `sla_policy_key`
- Lifecycle timestamps: `opened_at`, `triaged_at`, `assigned_at`, `in_progress_at`, `resolved_at`, `verified_at`, `dismissed_at`
- `closed_reason`, `reopen_count`, `created_by`, `updated_at`

## Supporting Tables

- **issue_sources** — Links issue to source evidence (source_type, source_ref, evidence_json).
- **issue_entities** — Links to external entities (entity_type, external_system, external_id, etc.).
- **issue_history** — State transitions and audit (event_type, old_state_json, new_state_json).
- **issue_actions** — Recommended or executed actions (action_type, action_status, external_system, target_ref).
- **issue_comments** — Comments (author_user_id, body, visibility).
- **change_issue_links** — Links changes to issues (change_id, issue_id, link_type: origin | related | caused | mitigates | blocked_by).

## Source Taxonomy

- `change` | `detector` | `integration_event` | `incident` | `manual` | `system_health` | `verification_failure`

## Impact and Verification

- **impact_assessments** — Attached to issues (model_key, revenue_at_risk, customer_count_affected, confidence_score, etc.).
- **verification_runs** / **verification_evidence** — Verification type, status, result, evidence.

## Execution and Routing

- **routing_rules** — Org/domain/source/severity → owner_type, owner_ref, sla_policy_key.
- **execution_tasks** — issue_id, external_system, external_task_id, task_type, status.
