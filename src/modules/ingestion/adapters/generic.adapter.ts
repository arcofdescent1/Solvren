/**
 * Phase 2 — Default normalization: financial minimization only.
 */
import { applyFinancialMinimization } from "./financial-bands";

export function genericNormalize(redacted: Record<string, unknown>): Record<string, unknown> {
  return applyFinancialMinimization({ ...redacted });
}
