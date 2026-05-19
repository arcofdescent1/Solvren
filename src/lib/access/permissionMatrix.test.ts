import { describe, expect, it } from "vitest";
import { CHANGE_PERMISSION_MATRIX, TRUST_AUDIT_COVERAGE, matrixRowsForRole } from "./permissionMatrix";
import type { OrgRole } from "@/lib/rbac/roles";

describe("CHANGE_PERMISSION_MATRIX", () => {
  it("covers every product role with view and edit guidance", () => {
    const roles: OrgRole[] = ["OWNER", "ADMIN", "REVIEWER", "SUBMITTER", "VIEWER"];
    for (const role of roles) {
      const rows = matrixRowsForRole(role);
      expect(rows.some((row) => row.action === "view")).toBe(true);
      expect(rows.some((row) => row.action === "edit")).toBe(true);
      expect(rows.every((row) => row.customerExplanation.length > 20)).toBe(true);
    }
  });

  it("documents the critical trust audit surfaces", () => {
    expect(TRUST_AUDIT_COVERAGE).toEqual(
      expect.arrayContaining([
        "Revenue exposure edits",
        "Approval decisions",
        "Domain permission changes",
        "Support access approval, denial, revocation, and break-glass flows",
        "Tenant purge dry-run, approval, verification, and execution",
      ])
    );
  });

  it("keeps viewer edit access explicitly denied", () => {
    expect(CHANGE_PERMISSION_MATRIX).toContainEqual(
      expect.objectContaining({
        role: "VIEWER",
        action: "edit",
        allowedWhen: "Never.",
      })
    );
  });
});
