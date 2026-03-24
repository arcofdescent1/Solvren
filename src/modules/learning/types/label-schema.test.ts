import { describe, expect, it } from "vitest";
import {
  EXPLICIT_LABEL_TYPES,
  IMPLICIT_LABEL_TYPES,
  isExplicitLabelType,
  isImplicitLabelType,
} from "./label-schema";

describe("label-schema", () => {
  it("classifies explicit taxonomy", () => {
    expect(isExplicitLabelType("GOOD_BLOCK")).toBe(true);
    expect(isExplicitLabelType("BAD_ALLOW")).toBe(true);
    expect(isExplicitLabelType("NOT_A_LABEL")).toBe(false);
    expect(EXPLICIT_LABEL_TYPES.length).toBeGreaterThan(0);
  });

  it("classifies implicit taxonomy", () => {
    expect(isImplicitLabelType("IMPLICIT_EXCESSIVE_APPROVAL_LATENCY")).toBe(true);
    expect(isImplicitLabelType("GOOD_BLOCK")).toBe(false);
    expect(IMPLICIT_LABEL_TYPES.length).toBeGreaterThan(0);
  });
});
