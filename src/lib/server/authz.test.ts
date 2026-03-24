import { describe, expect, it } from "vitest";
import { AuthzError, parseRequestedOrgId } from "./authz";
import { canRole, normalizePermission } from "@/lib/rbac/permissions";

describe("parseRequestedOrgId", () => {
  it("accepts valid UUID", () => {
    expect(parseRequestedOrgId("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "550e8400-e29b-41d4-a716-446655440000"
    );
  });

  it("throws AuthzError 400 for invalid", () => {
    expect(() => parseRequestedOrgId("not-a-uuid")).toThrow(AuthzError);
    try {
      parseRequestedOrgId(null);
    } catch (e) {
      expect(e).toBeInstanceOf(AuthzError);
      expect((e as AuthzError).status).toBe(400);
    }
  });
});

describe("normalizePermission aliases", () => {
  it("maps changes.* to canonical", () => {
    expect(normalizePermission("changes.view")).toBe("change.view");
    expect(normalizePermission("changes.submit")).toBe("change.submit");
  });
});

describe("RBAC Phase 0 policy coverage", () => {
  it("viewer cannot create change", () => {
    expect(canRole("VIEWER", "change.create")).toBe(false);
    expect(canRole("VIEWER", "changes.create")).toBe(false);
  });

  it("submitter can create and submit", () => {
    expect(canRole("SUBMITTER", "change.create")).toBe(true);
    expect(canRole("SUBMITTER", "change.submit")).toBe(true);
  });

  it("reviewer can approve", () => {
    expect(canRole("REVIEWER", "change.approve")).toBe(true);
    expect(canRole("REVIEWER", "change.create")).toBe(false);
  });

  it("admin-like can manage org settings", () => {
    expect(canRole("OWNER", "org.settings.manage")).toBe(true);
    expect(canRole("ADMIN", "org.users.manage")).toBe(true);
    expect(canRole("REVIEWER", "org.settings.manage")).toBe(false);
  });
});
