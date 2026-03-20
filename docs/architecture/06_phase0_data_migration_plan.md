# Phase 0 — Data Migration Plan

## New Migrations (Phase 0 pack)

1. **135_phase0_issue_core.sql** — Enums and `issues` table; indexes on org_id + status, severity, source_type, domain_key, verification_status, priority_score.
2. **136_phase0_issue_links_and_history.sql** — issue_sources, issue_entities, issue_history, issue_actions, issue_comments.
3. **137_phase0_verification_foundation.sql** — verification_runs, verification_evidence.
4. **138_phase0_impact_foundation.sql** — impact_assessments.
5. **139_phase0_execution_routing_foundation.sql** — routing_rules, execution_tasks.
6. **140_phase0_change_issue_links.sql** — change_issue_links.
7. **141_phase0_issue_rls.sql** — RLS for issues and related tables (org-scoped, consistent with existing org member/role logic).
8. **142_phase0_backfill_change_to_issue_links.sql** — Backfill issue records for eligible high-risk changes/incidents only.

## Backfill Policy

- Do not create noise.
- Backfill only active or strategically important records.
- Preserve lineage; tag with source_type and source_ref.
- Mark backfilled impact as `phase0_estimated` where needed.

### Recommended backfill sets

- **A** — Current unresolved incidents.
- **B** — Current unresolved or submitted high-risk changes.
- **C** — Changes blocked on approvals or evidence that represent live risk.

### Do not backfill initially

- Resolved historical low-risk changes.
- Old alerts without actionable ownership.
- Stale data without clear relevance.
