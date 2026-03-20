import { describe, expect, it } from "vitest";
import {
  enterpriseCanEnqueueJobs,
  enterpriseCanManageIntegrations,
  enterpriseCanViewAuditLog,
  legacyOrgRoleToEnterprise,
} from "./enterprise-roles";

describe("enterprise-roles", () => {
  it("maps legacy roles to personas", () => {
    expect(legacyOrgRoleToEnterprise("owner")).toBe("admin");
    expect(legacyOrgRoleToEnterprise("admin")).toBe("admin");
    expect(legacyOrgRoleToEnterprise("submitter")).toBe("operator");
    expect(legacyOrgRoleToEnterprise("reviewer")).toBe("executive");
    expect(legacyOrgRoleToEnterprise("viewer")).toBe("viewer");
  });

  it("gates job enqueue to admin and operator", () => {
    expect(enterpriseCanEnqueueJobs("admin")).toBe(true);
    expect(enterpriseCanEnqueueJobs("operator")).toBe(true);
    expect(enterpriseCanEnqueueJobs("executive")).toBe(false);
    expect(enterpriseCanEnqueueJobs("viewer")).toBe(false);
  });

  it("gates integrations to admin and operator", () => {
    expect(enterpriseCanManageIntegrations("admin")).toBe(true);
    expect(enterpriseCanManageIntegrations("operator")).toBe(true);
    expect(enterpriseCanManageIntegrations("viewer")).toBe(false);
  });

  it("gates audit log to admin and executive", () => {
    expect(enterpriseCanViewAuditLog("admin")).toBe(true);
    expect(enterpriseCanViewAuditLog("executive")).toBe(true);
    expect(enterpriseCanViewAuditLog("operator")).toBe(false);
  });
});
