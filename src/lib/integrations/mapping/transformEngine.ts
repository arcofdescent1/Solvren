/**
 * Phase 1 — Transformation engine.
 * Transforms source values before canonical assignment.
 */

export type TransformSpec =
  | { type: "iso_date" }
  | { type: "unix_seconds" }
  | { type: "unix_ms" }
  | { type: "trim" }
  | { type: "lowercase" }
  | { type: "uppercase" }
  | { type: "null_if_empty" }
  | { type: "cents_to_dollars" }
  | { type: "normalize_currency"; to?: string }
  | { type: "enum"; mapping: Record<string, string> }
  | { type: "to_boolean" }
  | { type: "to_string" }
  | { type: "to_number" };

export function applyTransformChain(value: unknown, chain: TransformSpec[]): unknown {
  let current = value;
  for (const t of chain) {
    current = applyTransform(current, t);
  }
  return current;
}

function applyTransform(value: unknown, spec: TransformSpec): unknown {
  switch (spec.type) {
    case "trim":
      return typeof value === "string" ? value.trim() : value;
    case "lowercase":
      return typeof value === "string" ? value.toLowerCase() : value;
    case "uppercase":
      return typeof value === "string" ? value.toUpperCase() : value;
    case "null_if_empty":
      return value === "" || value === null || value === undefined ? null : value;
    case "iso_date":
      return toIsoDate(value);
    case "unix_seconds":
      return fromUnixSeconds(value);
    case "unix_ms":
      return fromUnixMs(value);
    case "cents_to_dollars":
      return centsToDollars(value);
    case "normalize_currency":
      return typeof value === "string" ? (value.toUpperCase().trim() || (spec.to ?? "USD")) : value;
    case "enum":
      return enumMap(value, spec.mapping);
    case "to_boolean":
      return toBoolean(value);
    case "to_string":
      return value == null ? null : String(value);
    case "to_number":
      return toNumber(value);
    default:
      return value;
  }
}

function toIsoDate(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof value === "number") {
    const d = value > 1e12 ? new Date(value) : new Date(value * 1000);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

function fromUnixSeconds(value: unknown): string | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  if (isNaN(n)) return null;
  const d = new Date(n * 1000);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function fromUnixMs(value: unknown): string | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  if (isNaN(n)) return null;
  const d = new Date(n);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function centsToDollars(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(n)) return null;
  return n / 100;
}

function enumMap(value: unknown, mapping: Record<string, string>): string | null {
  if (value == null) return null;
  const key = String(value).trim();
  return mapping[key] ?? mapping[key.toLowerCase()] ?? null;
}

function toBoolean(value: unknown): boolean | null {
  if (value == null) return null;
  if (typeof value === "boolean") return value;
  const s = String(value).toLowerCase().trim();
  if (["true", "1", "yes", "on"].includes(s)) return true;
  if (["false", "0", "no", "off"].includes(s)) return false;
  return null;
}

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return isNaN(n) ? null : n;
}
