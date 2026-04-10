import { describe, it, expect } from "vitest";
import { getRoutingPersona } from "./getRoutingPersona";

describe("getRoutingPersona", () => {
  it("OWNER beats VP_TECH for routing priority", () => {
    expect(
      getRoutingPersona({
        orgRole: "OWNER",
        roleKeysUpper: ["VP_TECH"],
      })
    ).toBe("EXECUTIVE");
  });

  it("ADMIN maps to OPERATOR without exec keys", () => {
    expect(getRoutingPersona({ orgRole: "ADMIN", roleKeysUpper: [] })).toBe("OPERATOR");
  });

  it("VP_TECH alone is senior tech leader", () => {
    expect(getRoutingPersona({ orgRole: "REVIEWER", roleKeysUpper: ["VP_TECH"] })).toBe("SENIOR_TECH_LEADER");
  });
});
