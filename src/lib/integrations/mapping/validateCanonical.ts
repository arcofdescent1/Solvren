/**
 * Phase 1 — Canonical object validation.
 */
import type { CanonicalObjectType } from "../canonicalSchema";
import { getCanonicalSchema } from "../canonicalSchema";

export type ValidationResult = {
  status: "success" | "warning" | "failed";
  errors: string[];
  warnings: string[];
};

export function validateCanonical(
  type: CanonicalObjectType,
  obj: Record<string, unknown>
): ValidationResult {
  const schema = getCanonicalSchema(type);
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const field of schema.required) {
    const val = obj[field];
    if (val === undefined || val === null || val === "") {
      errors.push(`Missing required field: ${field}`);
    }
  }

  const fieldTypes = schema.fields;
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    const expected = fieldTypes[key];
    if (!expected) {
      warnings.push(`Unknown field: ${key}`);
      continue;
    }
    const typeErr = checkType(key, value, expected);
    if (typeErr) errors.push(typeErr);
  }

  const status = errors.length > 0 ? "failed" : warnings.length > 0 ? "warning" : "success";
  return { status, errors, warnings };
}

function checkType(field: string, value: unknown, expected: string): string | null {
  switch (expected) {
    case "string":
      return typeof value === "string" ? null : `Field ${field} must be string`;
    case "number":
      return typeof value === "number" && !isNaN(value) ? null : `Field ${field} must be number`;
    case "boolean":
      return typeof value === "boolean" ? null : `Field ${field} must be boolean`;
    case "date":
      return typeof value === "string" && !isNaN(Date.parse(value)) ? null : `Field ${field} must be ISO date string`;
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value) ? null : `Field ${field} must be object`;
    case "array":
      return Array.isArray(value) ? null : `Field ${field} must be array`;
    default:
      return null;
  }
}
