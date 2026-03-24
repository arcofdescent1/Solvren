/**
 * Phase 6 — Explicit + implicit label taxonomy.
 */

export const EXPLICIT_LABEL_TYPES = [
  "GOOD_BLOCK",
  "BAD_BLOCK",
  "GOOD_ALLOW",
  "BAD_ALLOW",
  "SHOULD_REQUIRE_APPROVAL",
  "UNNECESSARY_APPROVAL",
  "GOOD_AUTONOMY_LIMIT",
  "TOO_RESTRICTIVE_AUTONOMY",
  "TOO_PERMISSIVE_AUTONOMY",
] as const;

export type ExplicitLabelType = (typeof EXPLICIT_LABEL_TYPES)[number];

/** Derived / proxy labels — must use label_source IMPLICIT */
export const IMPLICIT_LABEL_TYPES = [
  "IMPLICIT_MANUAL_OVERRIDE_AFTER_BLOCK",
  "IMPLICIT_REPEATED_RETRY_AFTER_DENIAL",
  "IMPLICIT_EXCESSIVE_APPROVAL_LATENCY",
  "IMPLICIT_EXECUTION_FAILED_AFTER_ALLOW",
  "IMPLICIT_RECURRENCE_AFTER_ALLOW",
  "IMPLICIT_NO_RECURRENCE_AFTER_BLOCK",
  "IMPLICIT_DEAD_LETTER_BURDEN",
  "IMPLICIT_REPEATED_EXCEPTION_USE",
] as const;

export type ImplicitLabelType = (typeof IMPLICIT_LABEL_TYPES)[number];

export type GovernanceLabelType = ExplicitLabelType | ImplicitLabelType | string;

export function isExplicitLabelType(t: string): t is ExplicitLabelType {
  return (EXPLICIT_LABEL_TYPES as readonly string[]).includes(t);
}

export function isImplicitLabelType(t: string): t is ImplicitLabelType {
  return (IMPLICIT_LABEL_TYPES as readonly string[]).includes(t);
}
