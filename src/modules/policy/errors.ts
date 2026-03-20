/**
 * Phase 3 — Policy enforcement errors.
 */
import type { PolicyDecision } from "./domain";

export class PolicyBlockedError extends Error {
  constructor(
    message: string,
    public readonly decision: PolicyDecision
  ) {
    super(message);
    this.name = "PolicyBlockedError";
  }
}
