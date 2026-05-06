/**
 * Phase 2 — Structured logs without raw payloads, headers, or tokens.
 */

export type SafeIngestLogFields = {
  source?: string;
  org_id?: string;
  provider?: string;
  redacted_count?: number;
  hashed_count?: number;
  dropped_count?: number;
  event_id?: string;
  error_code?: string;
};

const FORBIDDEN_KEYS = new Set([
  "payload",
  "headers",
  "authorization",
  "token",
  "access_token",
  "refresh_token",
  "secret",
  "password",
  "body",
  "raw",
]);

function scrubValue(key: string, value: unknown): unknown {
  const k = key.toLowerCase();
  if (FORBIDDEN_KEYS.has(k)) return "[omitted]";
  if (typeof value === "object" && value !== null) return "[omitted_object]";
  return value;
}

/** Prefer this over console.log for ingestion and webhook paths. */
export function safeLog(event: string, fields: SafeIngestLogFields & Record<string, unknown>): void {
  const out: Record<string, unknown> = { event };
  for (const [k, v] of Object.entries(fields)) {
    out[k] = scrubValue(k, v);
  }
  console.log(JSON.stringify(out));
}
