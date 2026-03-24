# Governance enforcement matrix (Phase 5)

Single enforcement path: `evaluateGovernance()` → canonical policy engine (`policies` + DSL) + read-time adapters (`revenue_policies`, `approval_policies*`) → conflict resolution → exceptions (where eligible) → `policy_decision_logs` (+ approval binding when required).

## In scope (v1)

| Journey | Enforcement point | Context builder notes |
|--------|-------------------|----------------------|
| Integration action execution | `preExecutionCheck` → `evaluateGovernance` | `target.resourceType`: `integration_action`, `actionKey`, `provider`, optional `issue` |
| Integration execution (defense in depth) | `executeActionWithReliability` → `runExecution` calls `preExecutionCheck` unless `policyAlreadyEnforced: true` | Same as row above; API routes and `createExecutionTask` set `policyAlreadyEnforced` after their own check |
| Change submit (→ IN_REVIEW) | `POST /api/changes/submit` before status update | `target.resourceType`: `change`, `transitionKey`: `submit`, `change.*` from change + assessment |
| Change approval (record APPROVED) | `POST /api/approvals/decide` when `decision: APPROVED` (after readiness + SLA gates) | `target.resourceType`: `change`, `transitionKey`: `approve` |
| Evidence waiver | `POST /api/changes/[id]/evidence/status` when `status: WAIVED` | `target.resourceType`: `evidence_waiver`, `resourceId`: evidence item id |
| Playbook run (admin) | `startWorkflow` | `target.resourceType`: `playbook_step`, `transitionKey`: `start`, `extensions.playbookKey`, `issue.*` |
| Playbook step advance | `advanceWorkflowStep` before moving `current_step_key` to a governed next step | Governed when next step JSON `type` is `action` (with `actionKey`), `notification`, or `approval`; `transitionKey`: `execute_step`, `extensions.playbookKey` + `workflowStepKey` |
| Issue action ranking | `rankAndSelectAction` (autonomy decision engine) | Per eligible action: `evaluateGovernance` with `persistDecisionLog: false`; automation pause still read from `org_autonomy_settings` |
| Issue automation (external actions) | `createExecutionTask` + `POST /api/issues/[issueId]/actions/execute` | `preExecutionCheck` then `executeAction` with `policyAlreadyEnforced: true` |

## Out of scope (v1)

- Passive issue state changes that do not execute external actions or escalate autonomy
- Reporting-only and UI-only interactions

## Legacy surfaces

- **Authoring:** `revenue_policies` and `approval_policies*` may still be edited in product UIs.
- **Enforcement:** They are **not** standalone engines; matches are merged in the canonical evaluator via adapters.

## Simulation

- `POST /api/settings/governance/simulate` (requires `policy.manage` for the default org): supply `GovernanceEvaluationContext` fields except `orgId` (forced from session). Default `persistDecisionLog: false`; set `persistDecisionLog: true` only when an auditable dry-run is intentional.
