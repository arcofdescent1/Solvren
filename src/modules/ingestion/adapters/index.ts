/**
 * Phase 2 — Per-provider normalization after redaction.
 */
import { genericNormalize } from "./generic.adapter";
import { normalizeHubspotPayload } from "./hubspot.adapter";
import { normalizeSlackPayload } from "./slack.adapter";
import { normalizeStripePayload } from "./stripe.adapter";

export type IngestionNormalizer = (redacted: Record<string, unknown>) => Record<string, unknown>;

export function getIngestionNormalizer(provider: string): IngestionNormalizer {
  const p = provider.trim().toLowerCase();
  if (p === "hubspot") return normalizeHubspotPayload;
  if (p === "stripe") return normalizeStripePayload;
  if (p === "slack") return normalizeSlackPayload;
  return genericNormalize;
}
