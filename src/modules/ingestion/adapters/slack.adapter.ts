/**
 * Phase 2 — Slack interaction / event payloads.
 */
import { genericNormalize } from "./generic.adapter";

export function normalizeSlackPayload(redacted: Record<string, unknown>): Record<string, unknown> {
  return genericNormalize(redacted);
}
