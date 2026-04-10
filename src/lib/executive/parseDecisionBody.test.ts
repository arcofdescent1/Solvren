import { describe, it, expect } from "vitest";
import { parseExecutiveDecisionBody } from "./parseDecisionBody";

describe("parseExecutiveDecisionBody", () => {
  it("accepts valid decisions", () => {
    expect(parseExecutiveDecisionBody({ decision: "DELAY", comment: "need QA" })?.decision).toBe("DELAY");
  });
  it("rejects unknown decision", () => {
    expect(parseExecutiveDecisionBody({ decision: "FOO" })).toBeNull();
  });
});
