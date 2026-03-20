/**
 * Phase 3 — HubSpot webhook signature validator (§10).
 * Supports v1 (SHA256 hash of client_secret + body) and v3 (HMAC-SHA256).
 */
import { createHmac, createHash, timingSafeEqual } from "crypto";

export type HubSpotValidatorResult = { valid: boolean; error?: string };

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

/** V1: SHA256(client_secret + request_body), compare to X-HubSpot-Signature */
export function validateHubSpotWebhookV1(
  rawBody: string,
  signature: string | null,
  clientSecret: string | null
): HubSpotValidatorResult {
  if (!clientSecret) return { valid: false, error: "HubSpot client secret not configured" };
  if (!signature) return { valid: false, error: "Missing X-HubSpot-Signature header" };

  const expected = createHash("sha256").update(clientSecret + rawBody).digest("hex");
  return { valid: safeCompare(signature, expected) };
}

/** V3: HMAC-SHA256(method + uri + body + timestamp), base64, compare to X-HubSpot-Signature-V3 */
export function validateHubSpotWebhookV3(
  method: string,
  uri: string,
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
  clientSecret: string | null
): HubSpotValidatorResult {
  if (!clientSecret) return { valid: false, error: "HubSpot client secret not configured" };
  if (!signature || !timestamp) return { valid: false, error: "Missing X-HubSpot-Signature-V3 or X-HubSpot-Request-Timestamp" };

  const age = Date.now() - parseInt(timestamp, 10);
  if (age > 5 * 60 * 1000) return { valid: false, error: "Request timestamp too old" };
  if (age < -5 * 60 * 1000) return { valid: false, error: "Request timestamp in future" };

  const source = method + uri + rawBody + timestamp;
  const expected = createHmac("sha256", clientSecret).update(source).digest("base64");
  return { valid: safeCompare(signature, expected) };
}

export function validateHubSpotWebhook(
  rawBody: string,
  signature: string | null,
  signatureV3: string | null,
  timestamp: string | null,
  clientSecret: string | null,
  method = "POST",
  uri = ""
): HubSpotValidatorResult {
  if (signatureV3 && timestamp) {
    return validateHubSpotWebhookV3(method, uri, rawBody, timestamp, signatureV3, clientSecret);
  }
  return validateHubSpotWebhookV1(rawBody, signature, clientSecret);
}
