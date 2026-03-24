# SOC pathway readiness

**Purpose:** Document Solvren's readiness to pursue SOC 2 certification. We operate a SOC-aligned control environment and can pursue formal attestation when required.

**Audience:** Leadership, sales, enterprise customers

---

## Required statement

> "We operate a SOC-aligned control environment and can pursue SOC 2 certification if required."

---

## Readiness components (Phase 2 + 3)

| Component | Status | Evidence |
|-----------|--------|----------|
| Control matrix | Done | [`control-matrix.md`](control-matrix.md) |
| Policies | Done | [`policies/`](policies/) |
| Evidence structure | Done | [`evidence/`](evidence/) |
| Operations cadence | Done | [`control-operations-calendar.md`](control-operations-calendar.md) |
| Access review | Monthly | `evidence/access-reviews/` |
| Backup/restore | Quarterly drill | `evidence/backups/` |
| Change verification | Monthly | `evidence/releases/` |
| Incident response | Documented | [`incident-response-runbook.md`](incident-response-runbook.md) |
| Vendor inventory | Maintained | [`vendor-inventory.md`](vendor-inventory.md), [`subprocessors.md`](subprocessors.md) |

---

## Optional next steps (when pursuing certification)

1. **Engage auditor** — Select SOC 2 Type I or Type II scope
2. **Gap assessment** — Auditor reviews controls vs trust services criteria
3. **Remediation** — Address any gaps before examination
4. **Examination** — Type I (point in time) or Type II (period of operation)
5. **Report** — Issue SOC 2 report for customer distribution

---

## Type I vs Type II

| | Type I | Type II |
|---|--------|---------|
| **Scope** | Design of controls at a point in time | Operating effectiveness over a period (e.g. 6–12 months) |
| **Evidence** | Policies, design docs | Design + evidence of operation |
| **Duration** | Shorter | Longer (auditor observes operations) |
| **Use case** | Initial validation | Ongoing trust; enterprise procurement |

---

## Customer-facing language

For enterprise customers and questionnaires:

- "Solvren has implemented a control framework consistent with SOC 2 trust services criteria. We maintain documented policies, evidence, and recurring operations. Formal SOC 2 Type I or Type II certification can be pursued when required by customer contracts or procurement."
