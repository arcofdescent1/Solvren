import type { ImportKind } from "./import-schemas";

export const importTemplates: Record<ImportKind, string[]> = {
  usage: ["eventId", "customerId", "workflowId", "runId", "occurredAt", "provider", "billingRoute", "model", "providerScopeId", "inputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens", "reasoningOutputTokens", "reportedCostUsd", "status"],
  outcomes: ["eventId", "customerId", "workflowId", "runId", "occurredAt", "status"],
  direct_costs: ["eventId", "customerId", "workflowId", "runId", "occurredAt", "category", "costUsd"],
  contracts: ["customerId", "customerName", "effectiveFrom", "billingPeriod", "baseFeeUsd", "includedOutcomes", "overageUsd", "discountPct", "targetMarginPct", "renewalOn"],
  statements: ["provider", "periodStart", "periodEnd", "totalUsd"],
};
