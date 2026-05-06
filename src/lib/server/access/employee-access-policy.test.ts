import { describe, expect, it } from "vitest";
import { evaluateEmployeeDataAccess } from "./employee-access-policy";

describe("evaluateEmployeeDataAccess", () => {
  it("allows metadata for any active path", () => {
    const d = evaluateEmployeeDataAccess("metadata", "SUPPORT", null, false);
    expect(d.allowed).toBe(true);
    expect(d.dataMaskingTier).toBe("metadata");
    expect(d.legalBasis).toBe("metadata_default");
  });

  it("denies masked without grant or break-glass", () => {
    const d = evaluateEmployeeDataAccess("masked", "SUPPORT", null, false);
    expect(d.allowed).toBe(false);
  });

  it("allows masked with masked grant", () => {
    const d = evaluateEmployeeDataAccess("masked", "SUPPORT", { id: "g1", access_level: "masked", status: "approved", expires_at: new Date(Date.now() + 60_000).toISOString(), starts_at: null }, false);
    expect(d.allowed).toBe(true);
    expect(d.dataMaskingTier).toBe("masked");
  });

  it("caps SUPPORT sensitive grant to masked tier", () => {
    const d = evaluateEmployeeDataAccess(
      "sensitive",
      "SUPPORT",
      {
        id: "g1",
        access_level: "sensitive",
        status: "approved",
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        starts_at: null,
      },
      false,
    );
    expect(d.allowed).toBe(true);
    expect(d.dataMaskingTier).toBe("masked");
  });

  it("denies sensitive without sensitive grant", () => {
    const d = evaluateEmployeeDataAccess(
      "sensitive",
      "ENGINEERING",
      {
        id: "g1",
        access_level: "masked",
        status: "approved",
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        starts_at: null,
      },
      false,
    );
    expect(d.allowed).toBe(false);
  });
});
