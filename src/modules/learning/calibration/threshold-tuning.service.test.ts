import { describe, expect, it } from "vitest";
import type { GovernanceDecisionFact } from "../data/governance-decision-facts.service";
import { proposeImpactThresholdFromFacts } from "./threshold-tuning.service";

function fact(impact: number | null, disposition: string): GovernanceDecisionFact {
  return {
    trace_id: crypto.randomUUID(),
    org_id: crypto.randomUUID(),
    decision_timestamp: new Date().toISOString(),
    resource_type: null,
    resource_id: null,
    action_key: "test.action",
    disposition,
    approval_required: false,
    impact_amount: impact,
    confidence: null,
  };
}

describe("proposeImpactThresholdFromFacts", () => {
  it("returns null when insufficient ALLOW samples", () => {
    const facts = [fact(100, "ALLOW"), fact(200, "ALLOW"), fact(300, "ALLOW")];
    expect(proposeImpactThresholdFromFacts(facts, { min: 0, max: 1e9 })).toBeNull();
  });

  it("clamps proposed value to bounds", () => {
    const facts: GovernanceDecisionFact[] = [];
    for (let i = 0; i < 10; i++) {
      facts.push(fact(1000 + i * 100, "ALLOW"));
    }
    const p = proposeImpactThresholdFromFacts(facts, { min: 500, max: 1200 });
    expect(p).not.toBeNull();
    expect(p!.proposedValue).toBeGreaterThanOrEqual(500);
    expect(p!.proposedValue).toBeLessThanOrEqual(1200);
  });
});
