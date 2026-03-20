/**
 * Phase 3 — Policy definition DSL (§8.1).
 */
import type { PolicyRule } from "./policy-rule";
import type { PolicyScope } from "./policy-scope";
import type { PolicyDisposition } from "./policy-disposition";

export type PolicyDefinition = {
  policyKey: string;
  displayName: string;
  description: string;

  scope: PolicyScope;
  scopeRef?: string | null;

  priorityOrder: number;
  status: "active" | "inactive" | "draft";

  rules: PolicyRule[];
  defaultDisposition: PolicyDisposition;

  effectiveFrom: string;
  effectiveTo?: string | null;
};
