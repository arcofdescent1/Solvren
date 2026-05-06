/**
 * Phase 4 — deterministic projection to DTOs from RESOURCE_ACCESS_MAP.
 */
import type { CustomerResourceType } from "./access-types";
import type { DataMaskingTier } from "./access-types";
import { RESOURCE_ACCESS_MAP } from "./resource-access-map";

const SECRET_SUBSTRINGS = [
  "access_token",
  "refresh_token",
  "client_secret",
  "credential",
  "secret",
  "password",
  "api_key",
  "payload",
  "raw_",
  "ciphertext",
  "webhook_secret",
];

function isSensitiveKey(k: string): boolean {
  const lower = k.toLowerCase();
  return SECRET_SUBSTRINGS.some((s) => lower.includes(s));
}

/** Pick allowlisted keys; strip known secret-bearing keys even in sensitive tier. */
export function projectCustomerRecord<T extends Record<string, unknown>>(
  resource: CustomerResourceType,
  tier: DataMaskingTier,
  row: T,
): Record<string, unknown> {
  const spec = RESOURCE_ACCESS_MAP[resource][tier];
  const out: Record<string, unknown> = {};

  if (spec === "*") {
    for (const [k, v] of Object.entries(row)) {
      if (isSensitiveKey(k)) continue;
      if (v !== null && typeof v === "object" && !Array.isArray(v)) {
        out[k] = "[OBJECT_REDACTED]";
        continue;
      }
      out[k] = v;
    }
    return out;
  }

  for (const key of spec) {
    if (key in row && !isSensitiveKey(key)) {
      out[key] = row[key];
    }
  }
  return out;
}

/** Hash placeholder for display (not cryptographic). */
export function maskEmailDisplay(email: string): string {
  const t = email.trim();
  if (!t.includes("@")) return "hash_redacted";
  const [local, domain] = t.split("@");
  const h = Buffer.from(t).toString("base64url").slice(0, 12);
  return `hash_${h}_${local.slice(0, 1)}…@${domain}`;
}

export function maskCurrencyDisplay(): string {
  return "$[MASKED]";
}

export function maskTitleDisplay(): string {
  return "[REDACTED]";
}

export function maskExternalIdDisplay(): string {
  return "[MASKED]";
}
