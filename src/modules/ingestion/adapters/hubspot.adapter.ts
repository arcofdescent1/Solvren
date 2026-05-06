/**
 * Phase 2 — HubSpot ingestion normalization.
 */
import { applyFinancialMinimization } from "./financial-bands";

export function normalizeHubspotPayload(redacted: Record<string, unknown>): Record<string, unknown> {
  return applyFinancialMinimization({ ...redacted });
}
