/**
 * Phase 1 Gap 1 — Unit tests for issue entity resolver.
 */
import { describe, it, expect } from "vitest";
import { resolveEntities } from "../issue-entity-resolver.service";

describe("resolveEntities", () => {
  it("resolves primary from evidence bundle entities", () => {
    const result = resolveEntities({
      signals: [],
      extractedEntities: [
        { entityType: "invoice", entityId: "ent-1", displayName: "INV-001" },
        { entityType: "subscription", entityId: "ent-2" },
      ],
    });
    expect(result.entities).toHaveLength(2);
    expect(result.entities[0]).toMatchObject({
      entityId: "ent-1",
      entityType: "invoice",
      role: "primary",
      confidence: 0.95,
    });
    expect(result.entities[1]).toMatchObject({
      entityId: "ent-2",
      entityType: "subscription",
      role: "secondary",
    });
    expect(result.missingPrimaryEntity).toBe(false);
  });

  it("resolves primary from signal primary_canonical_entity_id", () => {
    const result = resolveEntities({
      signals: [
        { id: "sig-1", signal_key: "payment_failed", primary_canonical_entity_id: "ent-99" },
      ],
    });
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0]).toMatchObject({
      entityId: "ent-99",
      entityType: "invoice",
      role: "primary",
    });
  });

  it("marks missing primary when no entities found", () => {
    const result = resolveEntities({
      signals: [],
    });
    expect(result.entities).toHaveLength(0);
    expect(result.missingPrimaryEntity).toBe(true);
    expect(result.reasonCode).toBe("missing_primary_entity");
  });

  it("uses explicit primaryCanonicalEntityId when provided", () => {
    const result = resolveEntities({
      signals: [],
      primaryCanonicalEntityId: "explicit-primary",
    });
    expect(result.entities[0]).toMatchObject({
      entityId: "explicit-primary",
      role: "primary",
    });
  });
});
