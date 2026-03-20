/**
 * Phase 1 — Terminal classification types for closure.
 */
export type TerminalClassificationType =
  | "resolved_success"
  | "resolved_failure"
  | "no_action_closed";

export const TERMINAL_CLASSIFICATION_TYPES: TerminalClassificationType[] = [
  "resolved_success",
  "resolved_failure",
  "no_action_closed",
];

export function isValidTerminalClassification(s: string): s is TerminalClassificationType {
  return TERMINAL_CLASSIFICATION_TYPES.includes(s as TerminalClassificationType);
}
