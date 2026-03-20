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

const ACTIONS: ActionDefinition[] = [
  // ─── Revenue Recovery (Stripe) ─────────────────────────────────────────
  {
    actionKey: "stripe.retry_payment",
    displayName: "Retry Payment",
    description: "Retry a failed charge. Low risk, auto-eligible.",
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
  {
    actionKey: "stripe.update_payment_method",
    displayName: "Update Payment Method",
    description: "Prompt customer to update payment method.",
    provider: "stripe",
    entityType: "customer",
    actionType: "write",
    riskLevel: "medium",
    requiredInputs: [{ key: "customerId", label: "Customer ID", type: "string", required: true }],
    optionalInputs: [],
    supportsBulk: true,
    requiresApproval: true,
    executionMode: "suggested",
    idempotencyStrategy: "conditional",
    sideEffects: ["sends email to customer", "updates billing"],
    successCriteria: ["customer updates card"],
    failureModes: ["customer ignores", "invalid card"],
    rollbackSupported: false,
    auditLevel: "standard",
    version: "1.0",
    category: "revenue_recovery",
  },
  {
    actionKey: "stripe.apply_discount",
    displayName: "Apply Discount",
    description: "Apply discount to save churn risk.",
    provider: "stripe",
    entityType: "subscription",
    actionType: "write",
    riskLevel: "medium",
    requiredInputs: [
      { key: "subscriptionId", label: "Subscription ID", type: "string", required: true },
      { key: "couponId", label: "Coupon ID", type: "string", required: true },
    ],
    optionalInputs: [],
    supportsBulk: false,
    requiresApproval: true,
    executionMode: "manual",
    idempotencyStrategy: "conditional",
    sideEffects: ["modifies subscription", "affects revenue"],
    successCriteria: ["discount applied"],
    failureModes: ["invalid coupon", "subscription cancelled"],
    rollbackSupported: true,
    auditLevel: "strict",
    version: "1.0",
    category: "revenue_recovery",
  },
  // ─── Funnel Recovery (HubSpot / Salesforce) ────────────────────────────
  {
    actionKey: "hubspot.assign_owner",
    displayName: "Assign Owner",
    description: "Assign a sales rep to deal or contact.",
    provider: "hubspot",
    entityType: "deal",
    actionType: "write",
    riskLevel: "low",
    requiredInputs: [
      { key: "dealId", label: "Deal ID", type: "string", required: true },
      { key: "ownerId", label: "Owner ID", type: "string", required: true },
    ],
    optionalInputs: [],
    supportsBulk: true,
    requiresApproval: false,
    executionMode: "suggested",
    idempotencyStrategy: "safe",
    sideEffects: ["updates deal ownership", "may trigger notifications"],
    successCriteria: ["owner assigned"],
    failureModes: ["invalid owner", "deal locked"],
    rollbackSupported: true,
    auditLevel: "standard",
    version: "1.0",
    category: "funnel_recovery",
  },
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
  {
    actionKey: "hubspot.update_stage",
    displayName: "Update Deal Stage",
    description: "Move deal to a pipeline stage.",
    provider: "hubspot",
    entityType: "deal",
    actionType: "write",
    riskLevel: "medium",
    requiredInputs: [
      { key: "dealId", label: "Deal ID", type: "string", required: true },
      { key: "stageId", label: "Stage ID", type: "string", required: true },
    ],
    optionalInputs: [],
    supportsBulk: false,
    requiresApproval: true,
    executionMode: "manual",
    idempotencyStrategy: "conditional",
    sideEffects: ["updates deal", "may trigger automation"],
    successCriteria: ["stage updated"],
    failureModes: ["invalid stage", "pipeline mismatch"],
    rollbackSupported: true,
    auditLevel: "standard",
    version: "1.0",
    category: "funnel_recovery",
  },
  // ─── Data Integrity ────────────────────────────────────────────────────
  {
    actionKey: "hubspot.fill_missing_field",
    displayName: "Fill Missing Field",
    description: "Fill a missing required field on a record.",
    provider: "hubspot",
    entityType: "contact",
    actionType: "write",
    riskLevel: "low",
    requiredInputs: [
      { key: "objectType", label: "Object Type", type: "string", required: true },
      { key: "objectId", label: "Object ID", type: "string", required: true },
      { key: "property", label: "Property", type: "string", required: true },
      { key: "value", label: "Value", type: "string", required: true },
    ],
    optionalInputs: [],
    supportsBulk: true,
    requiresApproval: false,
    executionMode: "suggested",
    idempotencyStrategy: "conditional",
    sideEffects: ["updates record"],
    successCriteria: ["field populated"],
    failureModes: ["invalid value", "read-only field"],
    rollbackSupported: true,
    auditLevel: "standard",
    version: "1.0",
    category: "data_repair",
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

/** Map actionKey (with optional provider prefix) to manifest actionKey for executeAction. */
const ACTION_KEY_MAP: Record<string, string> = {
  "stripe.retry_payment": "retry_payment",
  "stripe.update_payment_method": "update_payment_method",
  "stripe.apply_discount": "apply_discount",
  "hubspot.assign_owner": "assign_owner",
  "hubspot.create_task": "create_task",
  "hubspot.update_stage": "update_stage",
  "hubspot.fill_missing_field": "fill_missing_field",
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
