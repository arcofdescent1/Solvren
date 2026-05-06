/**
 * Phase 2 — Stripe-shaped payloads (often nested under data.object).
 */
import { applyFinancialMinimization } from "./financial-bands";

export function normalizeStripePayload(redacted: Record<string, unknown>): Record<string, unknown> {
  const base = applyFinancialMinimization({ ...redacted });
  const data = base.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const d = data as Record<string, unknown>;
    const obj = d.object;
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      const minimizedObj = applyFinancialMinimization(obj as Record<string, unknown>);
      return { ...base, data: { ...d, object: minimizedObj } };
    }
  }
  return base;
}
