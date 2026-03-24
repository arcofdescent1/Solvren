# Phase 6 — Metrics and objectives

This document defines how we measure “better” governance under Phase 6 v1: **constrained multi-objective** improvement with **non‑negotiable guardrails**.

## Objectives hierarchy

### Primary (optimize)

Reduce, subject to guardrails:

| Metric | Intent | Notes |
|--------|--------|--------|
| **False block rate** | Blocks that were wrong given outcomes / labels | Requires explicit or implicit “bad block” signals |
| **False allow rate** | Allows that should have been blocked or required approval | Pair with labels and recurrence |
| **Unnecessary approval rate** | Approvals that added friction without benefit | `UNNECESSARY_APPROVAL` labels, latency proxies |
| **Missed approval rate** | Allows that should have required approval | `SHOULD_REQUIRE_APPROVAL`, recurrence |

### Guardrails (must not materially worsen)

- Safety / compliance posture (policy outcomes, audit completeness).
- Revenue protection outcomes (where modeled).
- Customer-visible incident rate (where tracked).
- Policy explainability (recommendations remain traceable to evidence + simulation).

### Secondary (improve when primary + guardrails healthy)

- Time to recovery, automation usefulness, analyst/operator workload.

## Formulas (v1 — operational definitions)

Rates are **segmented** (org, environment, action family, policy tier) before rolling up. Denominators are chosen per metric:

### False block rate (proxy)

- **Numerator**: count of decisions with disposition `BLOCK` and at least one active label `BAD_BLOCK` (explicit) or equivalent implicit proxy marked `label_source = IMPLICIT` and `inferred: true` in analytics.
- **Denominator**: count of decisions with `BLOCK` in the segment/window.
- **Data sources**: `policy_decision_logs` → `governance_decision_facts`; labels from `governance_decision_labels` joined on `trace_id`.

### False allow rate (proxy)

- **Numerator**: `BAD_ALLOW` or implicit recurrence-after-allow where governance allowed.
- **Denominator**: count of `ALLOW` dispositions in segment.

### Unnecessary approval rate (proxy)

- **Numerator**: `UNNECESSARY_APPROVAL` explicit labels, optionally paired with low-severity / no downstream incident.
- **Denominator**: approvals completed (`APPROVED` on approval path) or `REQUIRE_APPROVAL` resolutions in window.

### Missed approval rate (proxy)

- **Numerator**: `SHOULD_REQUIRE_APPROVAL` on traces that were `ALLOW` without approval.
- **Denominator**: `ALLOW` dispositions (or high-risk subset if tagged).

### Operational: approval latency

- **Definition**: `resolved_at - decision_timestamp` for linked approval rows (ms), reported as p50/p90.
- **Source**: `governance_approval_outcome_facts.approval_latency_ms`.

### Operational: dead-letter / retry burden

- **Definition**: count or rate of dead-letter / retry events linked to the same trace or resource after a governance decision (implementation-specific connectors).

## Segment breakdowns

Minimum dimensions:

- `org_id`
- `environment` (dev/staging/prod)
- `action_key` / playbook family
- time window (rolling 7/30/90d)

## Guardrails in measurement

- **Explicit labels outrank implicit proxies** in reporting and in training priority.
- Implicit metrics must be labeled **inferred** in dashboards and datasets.
- No single metric (e.g. “recovered revenue”) overrides safety guardrails.

## References

- Canonical join: `docs/architecture/phase6_canonical_learning_contract.md`
- Safety / MLOps: `docs/architecture/phase6_safety_mlops_controls.md`
