# Security remediation register

**Purpose:** Track security gaps and control failures to closure. No control failure should vanish into chat or memory alone — it must land here or an equivalent tracked system.

**Owner:** Vendor / Policy Owner (process); individual owners per item  
**Related:** [`control-health-register.md`](control-health-register.md), [`exception-management.md`](exception-management.md)

---

## Required fields (per item)

| Field | Description |
|-------|-------------|
| **ID** | Format: `REM-YYYY-NN` (e.g. REM-2026-01) |
| **Title** | Short description |
| **Source** | incident \| access review \| restore drill \| monitoring review \| dependency review \| customer questionnaire \| internal discovery |
| **Severity** | Critical \| High \| Medium \| Low |
| **Owner** | Person responsible for closure |
| **Due date** | Target resolution date |
| **Status** | Open \| In progress \| Resolved \| Deferred (with exception) |
| **Linked evidence/incident** | Link to incident doc, evidence file, or ticket |
| **Notes** | Progress, blockers, decisions |

---

## Remediation register

| ID | Title | Source | Severity | Owner | Due | Status | Link | Notes |
|----|-------|--------|----------|-------|-----|--------|------|-------|
| *None* | | | | | | | | |

---

## Status definitions

| Status | Meaning |
|--------|---------|
| **Open** | Not yet started |
| **In progress** | Work underway |
| **Resolved** | Fixed; verified |
| **Deferred** | Exception approved; see exception register |

---

## Rules

- **Every control failure** (e.g. failed restore drill, access review gap) gets an entry.
- **Every audit gap** (e.g. new sensitive workflow without audit) gets an entry.
- **Deferred** items must have a corresponding entry in [`exception-management.md`](exception-management.md).
- Review open items in **weekly** exception/remediation review (see control operations calendar).
