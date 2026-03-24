/**
 * Phase 1 — Path resolver for mapping engine.
 * Supports dot notation, array indexing, nested objects.
 * Returns undefined if path missing; never throws.
 */

export function resolvePath(obj: unknown, path: string): unknown {
  if (obj == null) return undefined;
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    const bracket = part.indexOf("[");
    if (bracket >= 0) {
      const key = part.slice(0, bracket);
      const indexPart = part.slice(bracket);
      if (key) current = getValue(current, key);
      const matches = indexPart.matchAll(/\[(\d+)\]/g);
      for (const m of matches) {
        const idx = parseInt(m[1], 10);
        current = Array.isArray(current) ? current[idx] : undefined;
      }
    } else {
      current = getValue(current, part);
    }
  }
  return current;
}

function getValue(obj: unknown, key: string): unknown {
  if (obj == null) return undefined;
  if (typeof obj !== "object") return undefined;
  const rec = obj as Record<string, unknown>;
  return rec[key];
}
