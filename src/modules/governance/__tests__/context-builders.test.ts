import { describe, expect, it } from "vitest";
import {
  buildIntegrationActionGovernanceContext,
  policyEnvironmentToGovernance,
} from "../context-builders";
import { governanceContextToPolicyContext } from "../map-governance-context";

describe("policyEnvironmentToGovernance", () => {
  it("maps production to prod and sandbox cluster to dev", () => {
    expect(policyEnvironmentToGovernance("production")).toBe("prod");
    expect(policyEnvironmentToGovernance("staging")).toBe("staging");
    expect(policyEnvironmentToGovernance("sandbox")).toBe("dev");
    expect(policyEnvironmentToGovernance("demo")).toBe("dev");
  });
});

describe("buildIntegrationActionGovernanceContext", () => {
  it("round-trips playbookKey through policy context via extensions", () => {
    const g = buildIntegrationActionGovernanceContext({
      orgId: "org-1",
      environment: "production",
      actionKey: "stripe.refund",
      playbookKey: "payout_review",
      requestedMode: "approve_then_execute",
      actorUserId: "user-1",
      provider: "stripe",
    });
    const p = governanceContextToPolicyContext(g);
    expect(p.playbookKey).toBe("payout_review");
    expect(p.actionKey).toBe("stripe.refund");
    expect(p.orgId).toBe("org-1");
  });
});
