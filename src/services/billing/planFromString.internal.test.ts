import { describe, expect, it } from "vitest";
import { planFromString } from "./entitlements";

describe("planFromString (canonical internal API plans)", () => {
  it("maps legacy PRO to TEAM", () => {
    expect(planFromString("PRO")).toBe("TEAM");
  });

  it("accepts enterprise licensing tiers as outputs", () => {
    expect(planFromString("FREE")).toBe("FREE");
    expect(planFromString("TEAM")).toBe("TEAM");
    expect(planFromString("BUSINESS")).toBe("BUSINESS");
    expect(planFromString("ENTERPRISE")).toBe("ENTERPRISE");
    expect(planFromString("STRATEGIC_ENTERPRISE")).toBe("STRATEGIC_ENTERPRISE");
  });
});
