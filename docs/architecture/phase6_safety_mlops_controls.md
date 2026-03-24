# Phase 6 — Safety and MLOps-style controls

## Principles

- Learning **recommends**; **governance** approves production change.
- Kill switches **disable learning outputs**, not core enforcement.
- Drift and quality metrics **raise review signals**; they do not auto-mutate policy.

## Versioning

Persist for audit:

- `generation_version` / `calibration_job_version` on generated artifacts
- `dataset_snapshot_id` when batch jobs run over a defined window
- Simulation provenance on acceptance (link to evaluation or run id where available)

## Kill switches

| Layer | Control |
|-------|---------|
| Global | `LEARNING_GLOBAL_DISABLED` / `NEXT_PUBLIC_LEARNING_GLOBAL_DISABLED` env (`1` or `true`) |
| Org | `org_learning_settings.learning_disabled` |
| Feature | `calibration_disabled`, `rule_suggestions_disabled`, `autonomy_suggestions_disabled` |

Orchestration and APIs **must** respect these flags. **Governance enforcement** (`evaluateGovernance`) remains unchanged when learning is off.

## Drift monitoring (v1)

- Label distribution drift (explicit vs implicit counts over time)
- Disposition mix drift (`governance_decision_facts` / drift snapshot)
- False block / false allow rate shifts (label-driven)
- Recommendation acceptance / rejection rates
- Post-acceptance quality checks (manual review cadence)

## Audit events (examples)

- `learning_orchestrator_run` — job batch metadata
- `governance_decision_label_created` — human label on trace
- `governance_rule_suggestion_reviewed` / `governance_calibration_recommendation_reviewed` — reviewer, status, rationale
- `org_learning_settings_updated` — kill switch changes

## SOC / compliance evidence

For each accepted suggestion or calibration:

- Who accepted
- Evidence and simulation summary JSON retained on the row
- Policy/version change recorded via **normal** governance versioning (not a side-channel update)

## Pooled learning (Tier 2)

If used: **no** raw PII payloads; **no** org-identifying sensitive fields in shared aggregates; org-facing recommendations remain explainable and scoped.
