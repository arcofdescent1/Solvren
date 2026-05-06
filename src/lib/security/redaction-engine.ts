/**
 * Phase 2 — Type-preserving redaction for unknown JSON shapes.
 */
import { createHash } from "node:crypto";
import { DEFAULT_RULES, type DataHandlingRule, type FieldClassification } from "./data-classification";
import { getFallbackClassification, type FieldSchema } from "./field-schema-registry";

const DROP = Symbol("ingestion_drop");

export type PayloadAuditMeta = {
  redacted_count: number;
  hashed_count: number;
  dropped_count: number;
};

export type RedactPayloadResult = {
  sanitized: unknown;
  audit: PayloadAuditMeta;
};

function ingestionGlobalSalt(): string {
  return (
    process.env.INGESTION_HASH_GLOBAL_SALT ??
    process.env.ENCRYPTION_KEY ??
    "dev-only-ingestion-salt"
  );
}

export function hashIngestionValue(value: unknown, orgId: string): string {
  const material = `${String(value)}\u0000${orgId}\u0000${ingestionGlobalSalt()}`;
  return createHash("sha256").update(material, "utf8").digest("hex");
}

function effectiveHandling(fc: FieldClassification): DataHandlingRule {
  if (fc.handling === "ENCRYPT") return "DROP";
  if (fc.handling === "ALLOW" || fc.handling === "HASH" || fc.handling === "REDACT" || fc.handling === "DROP") {
    return fc.handling;
  }
  return DEFAULT_RULES[fc.sensitivity];
}

function matchPathParts(pathParts: string[], patternParts: string[]): boolean {
  if (patternParts.length !== pathParts.length) return false;
  for (let i = 0; i < pathParts.length; i++) {
    const p = patternParts[i];
    if (p === "*") continue;
    if (p === "[]") {
      if (!/^\d+$/.test(pathParts[i])) return false;
      continue;
    }
    if (pathParts[i] !== p) return false;
  }
  return true;
}

function resolveClassification(path: string, schema: FieldSchema): FieldClassification {
  const pathParts = path.split(".").filter(Boolean);
  let best: { fc: FieldClassification; score: number } | null = null;

  for (const [pattern, fc] of Object.entries(schema)) {
    const patternParts = pattern.split(".").filter(Boolean);
    if (!matchPathParts(pathParts, patternParts)) continue;
    const wildcards = patternParts.filter((x) => x === "*" || x === "[]").length;
    const score = 1000 - wildcards * 10 + pattern.length;
    if (!best || score > best.score) best = { fc, score };
  }

  if (best) {
    return {
      sensitivity: best.fc.sensitivity,
      handling: effectiveHandling(best.fc),
    };
  }

  return getFallbackClassification();
}

function redactScalar(value: unknown, rule: DataHandlingRule, orgId: string, audit: PayloadAuditMeta): unknown {
  if (rule === "ALLOW") return value;
  if (rule === "DROP") {
    audit.dropped_count++;
    return DROP;
  }
  if (rule === "HASH") {
    audit.hashed_count++;
    if (value === null || value === undefined) return value;
    return hashIngestionValue(value, orgId);
  }
  if (rule === "REDACT") {
    audit.redacted_count++;
    if (value === null || value === undefined) return value;
    if (typeof value === "string") return "[REDACTED]";
    if (typeof value === "number") return 0;
    if (typeof value === "boolean") return false;
    if (typeof value === "bigint") return BigInt(0);
    return "[REDACTED]";
  }
  return value;
}

function processNode(path: string, value: unknown, schema: FieldSchema, orgId: string, audit: PayloadAuditMeta): unknown {
  if (value === null || value === undefined) return value;

  const fc = resolveClassification(path, schema);
  const rule = effectiveHandling(fc);

  if (Array.isArray(value)) {
    if (rule === "DROP") {
      audit.dropped_count++;
      return DROP;
    }
    if (rule === "HASH") {
      audit.hashed_count++;
      return hashIngestionValue(JSON.stringify(value), orgId);
    }
    if (rule === "REDACT") {
      audit.redacted_count++;
      return [];
    }
    return value.map((item, i) => {
      const childPath = path ? `${path}.${i}` : `${i}`;
      return processNode(childPath, item, schema, orgId, audit);
    });
  }

  if (typeof value === "object") {
    if (rule === "DROP") {
      audit.dropped_count++;
      return DROP;
    }
    if (rule === "HASH") {
      audit.hashed_count++;
      return hashIngestionValue(JSON.stringify(value), orgId);
    }
    if (rule === "REDACT") {
      audit.redacted_count++;
      return {};
    }

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const childPath = path ? `${path}.${k}` : k;
      const child = processNode(childPath, v, schema, orgId, audit);
      if (child === DROP) continue;
      out[k] = child;
    }
    return out;
  }

  return redactScalar(value, rule, orgId, audit);
}

/**
 * Redacts payload using dot-path schema. Never throws; returns best-effort sanitized value.
 */
export function redactPayload(payload: unknown, schema: FieldSchema, orgId: string): RedactPayloadResult {
  const audit: PayloadAuditMeta = { redacted_count: 0, hashed_count: 0, dropped_count: 0 };

  try {
    const sanitized = processNode("", payload, schema, orgId, audit);
    if (sanitized === DROP) return { sanitized: null, audit };
    return { sanitized, audit };
  } catch {
    return {
      sanitized: null,
      audit: { redacted_count: audit.redacted_count + 1, hashed_count: audit.hashed_count, dropped_count: audit.dropped_count + 1 },
    };
  }
}
