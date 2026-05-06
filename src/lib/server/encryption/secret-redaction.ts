/**
 * Phase 3 — Redact secrets from objects before logging / Sentry.
 */

const SECRET_KEY_SUBSTRINGS = [
  "access_token",
  "refresh_token",
  "client_secret",
  "api_key",
  "webhook_secret",
  "authorization",
  "cookie",
  "password",
  "secret",
  "private_key",
  "private_app_token",
];

export function redactSecretsForLog(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map(redactSecretsForLog);
  }
  if (input !== null && typeof input === "object") {
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>).map(([key, value]) => {
        const lower = key.toLowerCase();
        if (SECRET_KEY_SUBSTRINGS.some((s) => lower.includes(s))) {
          return [key, "[REDACTED_SECRET]"];
        }
        return [key, redactSecretsForLog(value)];
      }),
    );
  }
  return input;
}
