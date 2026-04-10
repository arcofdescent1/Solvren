import { describe, it, expect } from "vitest";
import { deriveReadinessRows } from "./readinessDerivation";

describe("deriveReadinessRows", () => {
  it("marks Rollback READY when ROLLBACK evidence present", () => {
    const rows = deriveReadinessRows({
      approvals: [],
      evidenceKinds: new Set(["ROLLBACK"]),
      coordinationBlockers: [],
    });
    const rb = rows.find((r) => r.category === "Rollback Plan");
    expect(rb?.status).toBe("READY");
  });

  it("marks Finance BLOCKED on rejection", () => {
    const rows = deriveReadinessRows({
      approvals: [{ approval_area: "Finance Reviewer", decision: "REJECTED" }],
      evidenceKinds: new Set(),
      coordinationBlockers: [],
    });
    const fin = rows.find((r) => r.category === "Finance");
    expect(fin?.status).toBe("BLOCKED");
  });
});
