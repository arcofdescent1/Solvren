# Solvren security documentation

**Phase 0 (technical baseline):** [`../security-phase0.md`](../security-phase0.md) — authz, RLS, audit, headers, env validation.

**Phase 1:** Trust operations — crypto, retention, dual-key decrypt, scope, authz migration (see security-phase0 Phase 1 pointers).

**Phase 2 (SOC-ready):** operational controls, policies, evidence, and questionnaire alignment — start with [`control-matrix.md`](control-matrix.md).

**Phase 3 (continuous operations):** recurring control execution, evidence freshness, control health tracking — start with [`control-operations-calendar.md`](control-operations-calendar.md).

---

## Phase 2 deliverables

| Artifact | Purpose |
|----------|---------|
| [control-matrix.md](control-matrix.md) | Master controls → owners, evidence, cadence |
| [security-ownership.md](security-ownership.md) | Named responsibilities |
| [access-review-process.md](access-review-process.md) | Monthly access review |
| [change-management-runbook.md](change-management-runbook.md) | Ship + migrate + emergency |
| [incident-response-runbook.md](incident-response-runbook.md) | Severity + workflow |
| [secure-sdlc.md](secure-sdlc.md) | PR / security-sensitive / release checklists |
| [vendor-inventory.md](vendor-inventory.md) | Internal vendor detail |
| [subprocessors.md](subprocessors.md) | Customer-facing subprocessor summary |
| [questionnaire-pack.md](questionnaire-pack.md) | Standard trust questionnaire answers |
| [policies/](policies/) | Written policies |
| [evidence/](evidence/) | Control evidence (reviews, releases, incidents, etc.) |

---

## Technical references

[data-classification.md](data-classification.md), [backup-recovery.md](backup-recovery.md), [restore-test-checklist.md](restore-test-checklist.md), [encryption-key-rotation.md](encryption-key-rotation.md), [integration-tests.md](integration-tests.md).

---

## Phase 2 definition of done

Phase 2 is complete when:

- [x] Control matrix exists with owners and evidence sources
- [x] Core policies written (access, change, incident, data, backup, logging, vendor)
- [x] Access review, change management, incident response runbooks documented
- [x] Evidence folder structure and templates in place
- [x] Vendor and subprocessor inventory created
- [x] Security ownership assigned
- [x] Questionnaire pack created
- [ ] First access review executed and evidence filed
- [ ] First restore drill or tabletop completed (recommended)

*Run one access review and one restore/incident drill to validate processes; capture results as evidence.*

---

## Phase 3 deliverables (continuous operations)

| Artifact | Purpose |
|----------|---------|
| [control-operations-calendar.md](control-operations-calendar.md) | Cadence for daily, weekly, monthly, quarterly controls |
| [control-health-register.md](control-health-register.md) | Control status: healthy, due soon, overdue |
| [exception-management.md](exception-management.md) | Time-bounded exceptions when controls cannot be met |
| [evidence/evidence-operations.md](evidence/evidence-operations.md) | Evidence workflow, naming, freshness standards |
| [access-review-checklist.md](access-review-checklist.md) | Structured access review |
| [backup-validation-checklist.md](backup-validation-checklist.md) | Monthly validation, quarterly restore drill |
| [monitoring-review-checklist.md](monitoring-review-checklist.md) | Alert and monitoring review |
| [vendor-review-checklist.md](vendor-review-checklist.md) | Vendor (quarterly) and dependency (monthly) review |
| [change-verification-checklist.md](change-verification-checklist.md) | Change management verification |
| [audit-review-checklist.md](audit-review-checklist.md) | Audit logging completeness |
| [security-remediation-register.md](security-remediation-register.md) | Track control failures to closure |
| [quarterly-security-review-template.md](quarterly-security-review-template.md) | Leadership security review |

### Phase 3 definition of done

Phase 3 is complete when:

- [x] Control operations calendar exists with cadences
- [x] Control health register exists
- [x] Exception management process documented
- [x] Recurring checklists created
- [x] Evidence operations workflow and templates in place
- [ ] At least one full month of recurring controls executed
- [ ] Evidence exists for monthly controls
- [ ] At least one quarterly exercise completed or simulated
- [ ] Remediation register contains any discovered gaps
- [ ] Leadership review template filled once
