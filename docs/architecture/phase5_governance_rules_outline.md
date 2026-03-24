# Phase 5 — Governance Rules: Summary, Scope, and Ambiguity Log

> **Definition level: Low** — Requires a clear rule model, storage strategy, and product decisions before Phase 5 can be “complete.”

---

## 1. What Phase 5 means in this roadmap

Phase 5 is **not** “add more approval screens.” It is the phase where **who may do what, under which conditions, with what evidence, and with what audit trail** is expressed as **durable, evaluable rules** that the product enforces consistently across:

- **Integration actions** (e.g. Stripe retry, Slack post, Jira create issue) — already partially gated via `preExecutionCheck`.
- **Change lifecycle** (submit, approve, evidence, deploy) — historically the core of Solvren.
- **Issues / findings / playbooks** (autonomy modes, suggested vs auto vs blocked).
- **Optional:** revenue-specific controls (`revenue_policies`) and dynamic approval routing (`approval_policies` + conditions + roles).

**North-star outcome:** One mental model for “governance”: rules are **versioned**, **scoped** (org, environment, integration, action, playbook, issue family), **composable**, and **observable** (decision logs, overrides, exceptions).

---

## 2. Current repo state (relevant building blocks)

### 2.1 Policy engine (Phase 3 path — primary for integration execution)

| Piece | Role |
|-------|------|
| `policies` table (Phase 8 + 159 extensions) | Stores org/global policies; `rules_json`, `scope`, `scope_ref`, `default_disposition`, etc. |
| `src/modules/policy/domain/*` | DSL: `PolicyDefinition`, `PolicyRule`, conditions, effects (BLOCK, REQUIRE_APPROVAL, ALLOW, LIMIT_AUTONOMY_MODE). |
| `policy-evaluator.service.ts` | Loads policies, matches rules to `PolicyEvaluationContext`. |
| `policy-conflict-resolver.service.ts` | Resolves competing matches → disposition + approval requirements. |
| `policy-exception.service.ts` | Applies `policy_exceptions` overrides. |
| `policy-engine.service.ts` | Orchestrates evaluate → log → decision. |
| `policy_decision_logs` | Append-only audit of evaluations. |
| `preExecutionCheck.ts` | **Single enforcement hook** before integration `executeAction` / execution tasks. |

**Strength:** Clear evaluation pipeline and logging for the integration-action path.

**Gap:** Same engine is **not** obviously the single source of truth for **change approvals**, **domain templates**, and **revenue_policies** — those live in parallel concepts.

### 2.2 Parallel / legacy governance surfaces

| Surface | Location / tables | Notes |
|---------|-------------------|--------|
| **Dynamic approval policies** | `approval_policies`, `approval_policy_conditions`, `approval_policy_roles` (127) | Condition-based routing; may overlap with `PolicyRule` conditions. |
| **Revenue policies** | `revenue_policies` (130) | `rule_type`, `rule_config`, `enforcement_mode` (MONITOR / REQUIRE_APPROVAL / BLOCK) — **different shape** from Phase 3 DSL. |
| **Domain governance** | Domain templates, SLAs, approval requirements (e.g. 075, 028) | Change-centric; tied to domains and change lifecycle. |
| **Autonomy / playbooks** | Phase 8 `playbook_definitions`, `org_playbook_configs`, autonomy services | “What automation may do” vs “what humans must approve.” |
| **Settings policies UI** | `src/app/(app)/settings/policies`, `api/settings/policies` | May not align 1:1 with `policies` + DSL used by `evaluate()`. |
| **Admin policies API** | `api/admin/policies` | Admin-oriented CRUD; need clarity vs org self-service. |

### 2.3 Enforcement touchpoints (incomplete picture for Phase 5)

- **Integration actions:** `createExecutionTask` → `preExecutionCheck` → policy engine. **In scope for tightening.**
- **Changes / approvals:** Existing change and approval flows; **may not** call the same `evaluate()` path for every transition.
- **AI / automation:** Risk of bypass unless every sensitive path calls a shared guard.

---

## 3. Proposed Phase 5 scope (engineering + product)

### 3.1 Core objectives

1. **Canonical rule model** — Decide whether Phase 3 `PolicyDefinition` / `rules_json` is the **only** first-class rule representation, or how `revenue_policies` and `approval_policies` **map into** or **coexist with** it.
2. **Unified evaluation API** — One internal contract: `evaluateGovernance(context) → { allow | block | require_approval | limit_mode, trace }` used by execution, critical change transitions, and (optionally) playbook steps.
3. **Storage and lifecycle** — Draft → active → deprecated; versioning; who can edit (org admin vs platform admin); import/export.
4. **Exceptions** — First-class: time-bounded, audited, scoped (`policy_exceptions` pattern); conflict with “hard blocks always win” (Phase 8 guide).
5. **Observability** — Policy decision logs already exist; extend to **every** governance decision path or explicitly document exclusions.
6. **UX** — Authoring, simulation (“what would happen for this issue/action?”), and explainability (“blocked because rule X”).

### 3.2 Explicit non-goals (unless product expands scope)

- Full **no-code** rule builder for non-technical users (can be phased).
- **ML-driven** policy suggestions (reserved for Phase 6).
- Replacing **external** IdP / SoD tools — integrate at edges, don’t rebuild.

---

## 4. Ambiguities and open decisions

### 4.1 Single rule store vs federation

**Question:** Is there **one** policies table + DSL, with everything else as **views/adapters**, or do we keep **multiple** engines?

**Options:**

- **A — Unify:** Migrate or wrap `revenue_policies` and `approval_policies` into `policies` + `rules_json` (or generated rules at read time).
- **B — Federate:** Keep multiple stores; add a **facade** that runs evaluators in priority order (dangerous if order is unclear).
- **C — Domain-specific:** Keep revenue vs change vs integration policies separate forever (simple short-term, weak long-term story).

**Impact:** Migration cost, UI model, and compliance narrative (“where is the policy?”).

### 4.2 What is in the evaluation context?

Today `PolicyEvaluationContext` includes org, environment, actionKey, playbookKey, issueId, impactAmount, provider, etc.

**Unresolved:**

- **Issue** vs **change** vs **finding** — Are all represented in one context? Same issue linked to multiple changes?
- **Customer / segment / region** — In scope for v1?
- **Sensitive flags** (legal hold, finance hold) — Where do they live in context?
- **Confidence scores** from detectors — Phase 6 overlap; does Phase 5 allow thresholds on confidence?

### 4.3 Conflict resolution and priority

`policy-conflict-resolver` exists, but product must lock:

- Global vs org vs integration precedence.
- **Hard block** definition and whether any exception can override (Phase 8 doc says hard blocks win — verify implementation matches).
- Tie-breaking when two rules both REQUIRE_APPROVAL with different roles.

### 4.4 Approval binding

When `REQUIRE_APPROVAL` fires:

- Which **approval request** type is created (existing `approval_requests` vs change-specific flows)?
- How do **approval_policy_roles** map to **PolicyRuleEffectRequireApproval.approverRoles**?
- Multi-step vs single-step; quorum; delegation.

### 4.5 Enforcement coverage matrix

**Question:** Which user journeys **must** call the governance engine in Phase 5?

Examples to decide:

| Journey | Call unified evaluate? |
|---------|-------------------------|
| Integration action execute | Yes (today) |
| Change submit | ? |
| Change approve / reject | ? |
| Evidence attach / waive | ? |
| Issue state transitions driven by automation | ? |
| Playbook step execution | ? |

Without a matrix, engineering will either over-enforce or leave holes.

### 4.6 `revenue_policies` vs product roadmap

`revenue_policies` is a distinct product metaphor (discount limits, billing rules). **Either:**

- Fold into Phase 3 policy DSL as rule types, or
- Keep as a **separate** product module with explicit **bridge** into execution checks.

### 4.7 Admin vs org-owned policies

- Platform-wide **defaults** and **kill switches** (compliance).
- Org **override** boundaries — what can never be relaxed?

### 4.8 Testing and safety

- **Policy simulation** API for admins (already partially present in admin routes — align with Phase 5).
- **Regression tests** for rule packs (golden contexts → expected disposition).
- **Staging** policies: per-environment rules vs tags on same policy.

---

## 5. Suggested workstreams (once decisions are locked)

| ID | Workstream | Depends on |
|----|------------|------------|
| P5-A | Lock canonical model + migration plan for legacy tables | 4.1, 4.6 |
| P5-B | Evaluation context contract v1 (fields, sources, extensibility) | 4.2 |
| P5-C | Conflict + exception semantics (docs + tests + code alignment) | 4.3, 4.4 |
| P5-D | Enforcement matrix: wire `evaluate` / `preExecutionCheck` into each journey | 4.5 |
| P5-E | Authoring UX + simulation + decision log drill-down | 4.8 |
| P5-F | Versioning / effective dates / audit completeness | 3.1 |

---

## 6. Definition of done (Phase 5)

Phase 5 is **done** when:

- [ ] **Written spec** answers 4.1–4.5 (and 4.6–4.8 as needed).
- [ ] **One** documented rule model is authoritative for new work (with explicit adapters for legacy if any).
- [ ] **Enforcement matrix** is implemented for agreed journeys; gaps are explicitly listed as out of scope.
- [ ] **Exceptions** and **hard blocks** behave per product policy and are tested.
- [ ] **Org admins** can configure rules within allowed bounds; **platform** can ship defaults.
- [ ] **Audit:** decision logs (or equivalent) for each enforced path; no silent bypass for listed actions.

---

## 7. Relation to other phases

- **Phase 3:** Supplies **action keys** and execution — governance must stay aligned with registry and risk levels.
- **Phase 4:** Supplies **reliable events** — governance may eventually react to ingestion health (e.g. don’t auto-act if integration degraded); optional for Phase 5 v1.
- **Phase 6:** Learning/calibration **consumes** Phase 5 decisions (what was allowed/blocked and outcomes) — design logs accordingly.

---

## 8. Key references in repo

- `src/modules/policy/` — DSL, evaluator, engine, preExecutionCheck, repositories.
- `supabase/migrations/159_phase3_policy_enforcement.sql` — `policies` extensions, `policy_decision_logs`, related objects.
- `supabase/migrations/154_phase8_autonomy_orchestration.sql` — base `policies`, playbooks.
- `supabase/migrations/127_phase_abcd_governance_platform.sql` — `approval_policies*`.
- `supabase/migrations/130_revenue_policies.sql` — `revenue_policies`.
- `Implementation Guide Improvements/Solvren_Phase_8_Autonomy_Orchestration_Network_Intelligence_Comprehensive_Implementation_Guide.md` — §10 Policy Engine (conceptual; verify vs code).

---

## 9. Bottom line

**Phase 5 is blocked on product/architecture choices**, not on lack of code. The repo already has a **credible policy engine** for integration execution; Phase 5 is about **making governance coherent**: one rule story, full enforcement coverage, clear exceptions, and alignment of legacy tables (`revenue_policies`, `approval_policies`) with that story—or a deliberate, documented split.
