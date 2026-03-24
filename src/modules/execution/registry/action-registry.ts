/**
 * Phase 6 Deep Expansion — Action registry (§14).
 * Central catalog of all executable actions across systems.
 * "Fix API for revenue problems" — the core moat.
 */
import type { ActionDefinition } from "../domain/contracts";

/** Legacy params schema for backward compatibility with existing UI. */
export type LegacyParamsSchema = Array<{
  key: string;
  label: string;
  type: "string" | "number" | "boolean";
  required?: boolean;
}>;

/** Action definition with legacy paramsSchema for UI. */
export type ActionDefinitionWithLegacy = ActionDefinition & {
  paramsSchema: LegacyParamsSchema;
};

function toLegacyParams(def: ActionDefinition): LegacyParamsSchema {
  const all = [...def.requiredInputs, ...def.optionalInputs];
  return all.map((i) => ({
    key: i.key,
    label: i.label,
    type: i.type === "json" ? "string" : i.type,
    required: i.required,
  }));
}

/** Phase 3 v1 — Implemented actions only. Out of scope: update_payment_method, apply_discount, update_stage, fill_missing_field, assign_owner. */
const ACTIONS: ActionDefinition[] = [
  // ─── Revenue Recovery (Stripe) ─────────────────────────────────────────
  {
    actionKey: "stripe.retry_payment",
    displayName: "Retry Payment",
    description: "Retry a failed invoice payment. Low risk, idempotent per invoice.",
    provider: "stripe",
    entityType: "invoice",
    actionType: "write",
    riskLevel: "low",
    requiredInputs: [{ key: "invoiceId", label: "Invoice ID", type: "string", required: true }],
    optionalInputs: [],
    supportsBulk: true,
    requiresApproval: false,
    executionMode: "auto",
    idempotencyStrategy: "safe",
    sideEffects: ["attempts charge", "may trigger webhook"],
    successCriteria: ["charge succeeds", "invoice paid"],
    failureModes: ["card declined", "insufficient funds"],
    rollbackSupported: false,
    auditLevel: "standard",
    version: "1.0",
    category: "revenue_recovery",
  },
  // ─── Funnel Recovery (HubSpot) ─────────────────────────────────────────
  {
    actionKey: "hubspot.create_task",
    displayName: "Create Follow-up Task",
    description: "Create a follow-up task for a contact or deal.",
    provider: "hubspot",
    entityType: "task",
    actionType: "write",
    riskLevel: "low",
    requiredInputs: [
      { key: "subject", label: "Subject", type: "string", required: true },
      { key: "ownerId", label: "Owner ID", type: "string", required: true },
      { key: "associationType", label: "Association Type", type: "string", required: true },
      { key: "associationId", label: "Association ID", type: "string", required: true },
    ],
    optionalInputs: [{ key: "dueDate", label: "Due Date", type: "string", required: false }],
    supportsBulk: true,
    requiresApproval: false,
    executionMode: "suggested",
    idempotencyStrategy: "unsafe",
    sideEffects: ["creates task", "notifies owner"],
    successCriteria: ["task created"],
    failureModes: ["invalid association", "owner not found"],
    rollbackSupported: false,
    auditLevel: "standard",
    version: "1.0",
    category: "funnel_recovery",
  },
  // ─── Work Management (Jira) ────────────────────────────────────────────
  {
    actionKey: "jira.create_issue",
    displayName: "Create Jira Issue",
    description: "Create a Jira issue linked to this Solvren issue.",
    provider: "jira",
    entityType: "issue",
    actionType: "write",
    riskLevel: "low",
    requiredInputs: [
      { key: "projectKey", label: "Project Key", type: "string", required: true },
      { key: "summary", label: "Summary", type: "string", required: true },
    ],
    optionalInputs: [{ key: "issueType", label: "Issue Type", type: "string", required: false }],
    supportsBulk: false,
    requiresApproval: false,
    executionMode: "manual",
    idempotencyStrategy: "unsafe",
    sideEffects: ["creates Jira issue", "links to Solvren issue"],
    successCriteria: ["issue created"],
    failureModes: ["invalid project", "permission denied"],
    rollbackSupported: false,
    auditLevel: "standard",
    version: "1.0",
    category: "funnel_recovery",
  },
  // ─── Alerts (Slack) ────────────────────────────────────────────────────
  {
    actionKey: "slack.post_message",
    displayName: "Post to Slack",
    description: "Post an alert or summary to a Slack channel.",
    provider: "slack",
    entityType: "message",
    actionType: "write",
    riskLevel: "low",
    requiredInputs: [
      { key: "channelId", label: "Channel ID", type: "string", required: true },
      { key: "message", label: "Message", type: "string", required: true },
    ],
    optionalInputs: [],
    supportsBulk: false,
    requiresApproval: false,
    executionMode: "manual",
    idempotencyStrategy: "unsafe",
    sideEffects: ["sends message", "notifies channel"],
    successCriteria: ["message posted"],
    failureModes: ["channel not found", "bot not in channel"],
    rollbackSupported: false,
    auditLevel: "standard",
    version: "1.0",
    category: "funnel_recovery",
  },
  {
    actionKey: "slack.post_issue_summary",
    displayName: "Post Issue Summary to Slack",
    description: "Post a formatted issue summary to a Slack channel.",
    provider: "slack",
    entityType: "message",
    actionType: "write",
    riskLevel: "low",
    requiredInputs: [{ key: "channelId", label: "Channel ID", type: "string", required: true }],
    optionalInputs: [],
    supportsBulk: false,
    requiresApproval: false,
    executionMode: "manual",
    idempotencyStrategy: "unsafe",
    sideEffects: ["sends message"],
    successCriteria: ["message posted"],
    failureModes: ["channel not found"],
    rollbackSupported: false,
    auditLevel: "standard",
    version: "1.0",
    category: "funnel_recovery",
  },
];

/** Map actionKey (with optional provider prefix) to manifest actionKey for executeAction. Phase 3 v1 only. */
const ACTION_KEY_MAP: Record<string, string> = {
  "stripe.retry_payment": "retry_payment",
  "hubspot.create_task": "create_task",
  "jira.create_issue": "create_issue",
  "slack.post_message": "post_message",
  "slack.post_issue_summary": "post_issue_summary",
};

export function getManifestActionKey(actionKey: string): string {
  return ACTION_KEY_MAP[actionKey] ?? actionKey;
}

export function getActionsForProvider(provider: string): ActionDefinitionWithLegacy[] {
  return ACTIONS.filter((a) => a.provider === provider).map((a) => ({
    ...a,
    paramsSchema: toLegacyParams(a),
  }));
}

export function getAction(
  actionKey: string,
  provider?: string
): ActionDefinitionWithLegacy | undefined {
  const def = ACTIONS.find(
    (a) =>
      a.actionKey === actionKey ||
      a.actionKey === `${provider}.${actionKey}` ||
      (provider && a.provider === provider && a.actionKey.endsWith(`.${actionKey}`))
  );
  if (!def) return undefined;
  return { ...def, paramsSchema: toLegacyParams(def) };
}

export function listAllActions(): ActionDefinitionWithLegacy[] {
  return ACTIONS.map((a) => ({ ...a, paramsSchema: toLegacyParams(a) }));
}

export function getActionsByCategory(
  category: ActionDefinition["category"]
): ActionDefinitionWithLegacy[] {
  return ACTIONS.filter((a) => a.category === category).map((a) => ({
    ...a,
    paramsSchema: toLegacyParams(a),
  }));
}

export function getActionsForAutoExecution(): ActionDefinitionWithLegacy[] {
  return ACTIONS.filter((a) => a.executionMode === "auto").map((a) => ({
    ...a,
    paramsSchema: toLegacyParams(a),
  }));
}
