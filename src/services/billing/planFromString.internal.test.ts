import { describe, expect, it } from "vitest";
import { planFromString } from "./entitlements";

describe("planFromString (canonical internal API plans)", () => {
  it("maps TEAM to PRO", () => {
    expect(planFromString("TEAM")).toBe("PRO");
  });

  it("accepts FREE PRO BUSINESS only as outputs", () => {
    expect(planFromString("FREE")).toBe("FREE");
    expect(planFromString("PRO")).toBe("PRO");
    expect(planFromString("BUSINESS")).toBe("BUSINESS");
  });
});
