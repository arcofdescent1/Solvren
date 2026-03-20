/**
 * Phase 3 — Salesforce webhook validator (§10).
 * Platform Events and Outbound Messages typically use no signature; org context from payload.
 */
export type SalesforceValidatorResult = { valid: boolean; error?: string };

/** Salesforce outbound messages / platform events have no standard signature. */
export function validateSalesforceWebhook(
  _rawBody: string,
  _headers: Record<string, string>
): SalesforceValidatorResult {
  return { valid: true };
}
