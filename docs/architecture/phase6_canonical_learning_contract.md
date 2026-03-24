# Phase 6 — Canonical learning contract

## Golden join path

**Source of truth for governance decisions:** `policy_decision_logs`.

**Canonical trace identifier:** `policy_decision_logs.id` (referenced everywhere as `trace_id`).

**Learning join path:**

```
policy_decision_logs.id (trace_id)
  → governed resource / action / change / issue references (in evaluation_context_json and related entities)
  → approval_requests (via source_policy_decision_log_id)
  → execution / integration outcomes (`integration_action_executions.governance_trace_id` is set on insert when the caller passes the trace from `preExecutionCheck`, patched after an in-path governance evaluation in `executeActionWithReliability`, or supplied on **retry after policy approval** via `policyApprovalRequestId` → `approval_requests.source_policy_decision_log_id` in `createExecutionTask` / integration action POST)
  → derived labels and analytics views
```

Learning jobs **must** consume **projections** below (or successor materialized tables), not ad hoc joins across fragmented operational tables from feature code.

## Views / tables (v1)

| Artifact | Purpose |
|----------|---------|
| `governance_decision_facts` | Normalized decision attributes for analytics (view on `policy_decision_logs`) |
| `governance_approval_outcome_facts` | Approval status and latency keyed by `trace_id` |
| `governance_feedback_facts` | Active labels joined to decision context |
| `governance_decision_labels` | Append-only explicit + implicit labels |
| `governance_rule_suggestions` | Draft rule / autonomy suggestions with evidence + simulation summaries |
| `governance_calibration_recommendations` | Bounded numeric calibration proposals |
| `org_learning_settings` | Per-org kill switches |

## `governance_decision_facts` (minimum fields)

Aligned with implementation:

- `trace_id`, `org_id`, `decision_timestamp`
- `resource_type`, `resource_id` (from evaluation context)
- `action_key`, `provider`, `disposition`
- Rule metadata: `matched_rules_json`, etc.
- `approval_required`, autonomy fields, `environment`, `issue_severity`
- `impact_amount`, `confidence` (when present in context)

## Outcome facts

Outcome rows tie **`trace_id`** to:

- Approval record and latency (`governance_approval_outcome_facts`).
- Execution / integration outcomes when `governance_trace_id` is set on executions.
- Issue resolution and revenue/incident signals via application-level joins from resource IDs in context.

## Tenancy

- **Tier 1 (default):** per-org facts and recommendations; RLS enforces `is_org_member(org_id)`.
- **Tier 2 (optional platform aggregates):** only minimized/anonymized features; no raw payloads; no org-identifying fields in pooled training sets.

## Versioning

Artifacts store `generation_version`, `dataset_snapshot_id`, `calibration_job_version` where applicable so acceptance audits retain provenance.

## Simulation fidelity

Recommendation-grade evaluation **must** use the same `evaluateGovernance` path as production. Exploratory tiers must be explicitly labeled and **must not** drive shipped recommendations (see simulate API `simulationTier`).
