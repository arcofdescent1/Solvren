import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("authentication redirects", () => {
  it("retains internal invite paths", () => expect(safeNext("/invite/abc?x=1")).toBe("/invite/abc?x=1"));
  it("rejects protocol-relative and backslash redirects", () => {
    expect(safeNext("//attacker.example")).toBe("/workspace");
    expect(safeNext("/\\attacker.example")).toBe("/workspace");
  });
});
