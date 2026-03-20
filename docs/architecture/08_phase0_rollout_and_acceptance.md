# Phase 0 — Rollout and Acceptance

## Rollout Steps

1. **Architecture and schema** — Merge migration pack; create module skeletons; add issue APIs (optionally behind feature flags).
2. **Change remapping** — Add change_issue_links; expose linked issues on change pages; run backfill for eligible changes/incidents.
3. **Issue UI release** — Ship Issues index and Issue detail; keep existing change-centric flows.
4. **Reporting alignment** — Update executive and ops views to aggregate via issue model.
5. **Policy enforcement** — All new feature work against issue model; deprecate direct lifecycle extensions to legacy change-only flows.

## Acceptance Criteria (Phase 0 complete when all true)

1. Single canonical issue object used across product and engineering.
2. A change can create or link to an issue without defining the whole product.
3. One enforced issue lifecycle with verification state.
4. Formal domain boundaries under `src/modules`.
5. New APIs for issue listing, detail, assignment, resolution, and verification.
6. At least one existing high-risk change flow maps into the issue model end to end.
7. Executive views can aggregate issues, not only change risk artifacts.
8. Integration and governance work explainable as part of the broader platform model.
9. Product, design, and docs use the new vocabulary consistently.
10. Phase 1 work can deepen integrations without inventing a parallel object model.
