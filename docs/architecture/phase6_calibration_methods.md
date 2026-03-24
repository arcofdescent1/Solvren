# Phase 6 — Calibration methods (v1)

Phase 6 v1 supports **bounded numeric** calibration only. It does **not** rewrite arbitrary rule logic.

## In scope

- Impact thresholds
- Confidence thresholds (where exposed as numeric parameters)
- Approval amount bands
- Autonomy caps / bands where exposed as bounded parameters
- Rule weights only when already modeled as numeric parameters with bounds

## Out of scope (v1)

- End-to-end learned policy execution
- Silent promotion of calibrations to production
- Relaxing platform **non-relaxable** controls

## Methods (start simple)

1. **Percentile analysis** on historical decision facts (e.g. p95 of impact amounts on ALLOW) to propose thresholds within bounds.
2. **Grid search** on a historical window over a discrete set of candidate values within `[min, max]`.
3. **Constrained optimization** on proxy objectives (e.g. balance false block / false allow proxies) with explicit bounds — only when simple methods fail.

## Bounds and authority

Every calibratable parameter must define:

- `min`, `max`
- **Platform lock** flags (non-relaxable controls cannot be weakened by learning)
- **Org override eligibility** where product allows

The calibration engine **emits rows** in `governance_calibration_recommendations` with status `DRAFT`. **Production change** requires human review and versioned policy/governance flow.

## Evidence and simulation

Each recommendation stores:

- `evidence_summary_json` (method, sample size, window)
- `simulation_summary_json` — must record whether **production-grade** `evaluateGovernance` was run before acceptance

Heuristic-only evaluation is allowed for exploration but must **not** be treated as production-grade (see `simulate` API `simulationTier`).
