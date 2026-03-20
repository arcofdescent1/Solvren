/**
 * Phase 1 Gap 1 — Issue entity resolver service (§7).
 * Resolves entities from detection result for issue linkage.
 */
import type { ResolvedEntity } from "./issue-linkage.service";

export type DetectionResultInput = {
  signals: Array<{
    id: string;
    signal_key: string;
    primary_canonical_entity_id?: string | null;
  }>;
  extractedEntities?: Array<{
    entityType: string;
    entityId?: string;
    displayName?: string;
  }>;
  primaryCanonicalEntityId?: string | null;
  secondaryEntityIds?: string[];
};

/**
 * Resolve entities from detection result.
 * Priority: explicit from detector → from evidence entities → from signals → heuristic.
 * Every issue MUST have >= 1 primary entity; if none found, returns low-confidence inferred.
 */
export function resolveEntities(input: DetectionResultInput): {
  entities: ResolvedEntity[];
  missingPrimaryEntity: boolean;
  reasonCode?: string;
} {
  const entities: ResolvedEntity[] = [];
  const seen = new Set<string>();

  function add(entityId: string, entityType: string, role: ResolvedEntity["role"], confidence: number, displayName?: string) {
    const key = `${entityType}:${entityId}`;
    if (seen.has(key)) return;
    seen.add(key);
    entities.push({ entityId, entityType, role, confidence, displayName: displayName ?? null });
  }

  // 1. Explicit primary from detector
  if (input.primaryCanonicalEntityId) {
    add(input.primaryCanonicalEntityId, inferEntityType(input), "primary", 1.0);
  }

  // 2. Entities from evidence bundle (extractedEntities)
  for (const e of input.extractedEntities ?? []) {
    const id = e.entityId;
    if (!id) continue;
    const type = e.entityType || "unknown";
    const role = entities.some((x) => x.role === "primary") ? "secondary" : "primary";
    add(id, type, role, 0.95, e.displayName);
  }

  // 3. From signals (primary_canonical_entity_id)
  for (const sig of input.signals) {
    const id = sig.primary_canonical_entity_id;
    if (!id) continue;
    const type = inferEntityTypeFromSignal(sig);
    if (!entities.some((x) => x.entityId === id)) {
      const role = entities.some((x) => x.role === "primary") ? "secondary" : "primary";
      add(id, type, role, 0.9);
    }
  }

  // 4. Secondary entity IDs from detector
  for (const id of input.secondaryEntityIds ?? []) {
    if (!seen.has(`unknown:${id}`) && !entities.some((x) => x.entityId === id)) {
      add(id, "unknown", "secondary", 0.85);
    }
  }

  const hasPrimary = entities.some((e) => e.role === "primary");
  if (!hasPrimary && entities.length > 0) {
    entities[0]!.role = "primary";
  }

  if (!hasPrimary && entities.length === 0) {
    return {
      entities: [],
      missingPrimaryEntity: true,
      reasonCode: "missing_primary_entity",
    };
  }

  return {
    entities,
    missingPrimaryEntity: false,
  };
}

function inferEntityType(input: DetectionResultInput): string {
  const first = input.extractedEntities?.[0]?.entityType;
  if (first) return first;
  const sig = input.signals[0];
  return sig ? inferEntityTypeFromSignal(sig) : "unknown";
}

function inferEntityTypeFromSignal(sig: { signal_key: string }): string {
  const key = (sig.signal_key ?? "").toLowerCase();
  if (key.includes("invoice") || key.includes("payment")) return "invoice";
  if (key.includes("subscription")) return "subscription";
  if (key.includes("contact") || key.includes("lead")) return "contact";
  if (key.includes("opportunity") || key.includes("deal")) return "opportunity";
  if (key.includes("change")) return "change";
  return "unknown";
}
