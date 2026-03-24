# Governance precedence and exceptions (Phase 5 v1)

## Precedence (conflict resolver)

Resolved in `policy-conflict-resolver.service.ts` using rule metadata:

1. Platform hard block  
2. Org hard block  
3. Platform require approval  
4. Org require approval  
5. Platform allow / limit autonomy  
6. Org allow / limit autonomy  
7. Default disposition  
8. Non-hard “soft” block handling remains subordinate to the above ordering in the merged outcome  

**Hard blocks** are represented on canonical rules via `hardBlock` (and policy ownership via `policy_owner_type`).

## Exceptions

- Exceptions are **time-bounded** and **scoped** in `policy_exceptions` (see `policy-exception.service.ts`).
- A block may be overridden by an applicable exception only if the blocking rule is **exception-eligible** (`exceptionEligible !== false` on the rule; default remains eligible for legacy rules).
- **Non–exception-eligible hard blocks** cannot be bypassed by ordinary approval or legacy approval flows—only an eligible exception path applies.

## Approval merge

When multiple rules require approval:

- Approver roles are **unioned**
- **Highest** required approval count (quorum) wins
- If the resolved outcome is a **final block**, approval is not offered

## Ownership

Canonical policies carry `policy_owner_type` (PLATFORM | ORG) and `relaxation_mode` (RELAXABLE | NON_RELAXABLE) on the `policies` row. Platform **non-relaxable** controls must not be weakened by org-authored policy (enforced at authoring/API layers over time; resolver prefers platform outcomes as above).

## Audit

- Each evaluation that persists logging writes to **`policy_decision_logs`** with the evaluation context and matched rules.
- Governance outcomes exposed to the product use **`GovernanceDecision`** (`traceId` aligns with the decision log id when logging is enabled).
