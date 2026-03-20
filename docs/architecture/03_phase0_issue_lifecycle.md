# Phase 0 — Issue Lifecycle

## Canonical Lifecycle

```
open → triaged → assigned → in_progress → resolved → verified
```

Alternative terminal: any active state → **dismissed**.

Regression: **resolved** → (verification failure) → **open**; **verified** → (new evidence/regression) → new issue or reopen per rule.

## Transition Rules

| From → To | Allowed when |
|-----------|--------------|
| open → triaged | Source evidence exists; not duplicate-dismissed; initial severity and domain set |
| triaged → assigned | Owner user or team exists; routing rationale recorded |
| assigned → in_progress | Assignee accepted or execution task created |
| in_progress → resolved | Resolution summary entered; at least one action/task (unless exempt); verification policy attached |
| resolved → verified | Verification run passes or manual attestation accepted |
| any active → dismissed | Duplicate confirmed, false positive, or accepted risk documented |
| resolved → open | Verification fails; issue condition persists; regression detected |

## Audit Requirements

Every state transition must write:

- issue_history row
- Audit log entry
- Timeline event for UI
- Optional notification or task event per policy
