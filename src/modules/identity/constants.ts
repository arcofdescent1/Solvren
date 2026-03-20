/**
 * Phase 2 — Identity thresholds and config (§10.4, §10.5).
 * Thresholds should be configurable; these are defaults.
 */

export const DEFAULT_CONFIDENCE_THRESHOLDS = {
  /** >= autoLink: auto-link without review */
  autoLink: 0.98,
  /** >= reviewMin and < autoLink: create match candidate for review */
  reviewMin: 0.85,
  /** < reviewMin: create new entity or leave unresolved per object policy */
} as const;

export const ENTITY_TYPE_POLICY: Record<string, "create_new" | "create_or_candidate" | "flag_low_context"> = {
  person: "create_new",
  company: "create_new",
  opportunity: "create_new",
  subscription: "create_new",
  invoice: "create_new",
  payment: "create_new",
  meeting: "flag_low_context",
  workflow: "create_new",
  change: "create_new",
  incident: "create_new",
};
