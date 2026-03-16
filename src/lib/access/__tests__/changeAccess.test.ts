import { describe, it, expect } from "vitest";
import { canViewChangeWithContext } from "../changeAccess";
import type { OrgRole } from "@/lib/rbac/roles";
import type { ChangeVisibilityRow } from "../changeAccess";

function ctx(opts: {
  roleByOrgId: Map<string, OrgRole>;
  domainViewByOrgDomain?: Map<string, boolean>;
  domainReviewByOrgDomain?: Map<string, boolean>;
  assignedChangeIds?: Set<string>;
  explicitChangeIds?: Set<string>;
}) {
  return {
    roleByOrgId: opts.roleByOrgId,
    domainViewByOrgDomain: opts.domainViewByOrgDomain ?? new Map(),
    domainReviewByOrgDomain: opts.domainReviewByOrgDomain ?? new Map(),
    assignedChangeIds: opts.assignedChangeIds ?? new Set(),
    explicitChangeIds: opts.explicitChangeIds ?? new Set(),
  };
}

function row(overrides: Partial<ChangeVisibilityRow> = {}): ChangeVisibilityRow {
  return {
    id: "c1",
    org_id: "org1",
    domain: "REVENUE",
    status: "IN_REVIEW",
    created_by: "user-a",
    ...overrides,
  };
}

describe("canViewChangeWithContext", () => {
  const userId = "user-1";
  const orgId = "org1";

  it("OWNER can view any change", () => {
    const c = ctx({
      roleByOrgId: new Map([[orgId, "OWNER"]]),
    });
    expect(canViewChangeWithContext(userId, row({ is_restricted: true }), c)).toBe(true);
    expect(canViewChangeWithContext(userId, row({ created_by: "other" }), c)).toBe(true);
  });

  it("ADMIN can view any change", () => {
    const c = ctx({
      roleByOrgId: new Map([[orgId, "ADMIN"]]),
    });
    expect(canViewChangeWithContext(userId, row({ is_restricted: true }), c)).toBe(true);
  });

  it("restricted change: only creator, assigned, or explicit grant can view", () => {
    const c = ctx({
      roleByOrgId: new Map([[orgId, "REVIEWER"]]),
      assignedChangeIds: new Set(["c2"]),
      explicitChangeIds: new Set(["c3"]),
      domainViewByOrgDomain: new Map([["org1:REVENUE", true]]),
    });
    expect(canViewChangeWithContext(userId, row({ id: "c1", created_by: userId, is_restricted: true }), c)).toBe(true);
    expect(canViewChangeWithContext(userId, row({ id: "c2", created_by: "other", is_restricted: true }), c)).toBe(true);
    expect(canViewChangeWithContext(userId, row({ id: "c3", created_by: "other", is_restricted: true }), c)).toBe(true);
    expect(canViewChangeWithContext(userId, row({ id: "c4", created_by: "other", is_restricted: true }), c)).toBe(false);
  });

  it("REVIEWER sees IN_REVIEW/APPROVED when has domain view", () => {
    const c = ctx({
      roleByOrgId: new Map([[orgId, "REVIEWER"]]),
      domainViewByOrgDomain: new Map([["org1:REVENUE", true]]),
    });
    expect(canViewChangeWithContext(userId, row({ status: "IN_REVIEW" }), c)).toBe(true);
    expect(canViewChangeWithContext(userId, row({ status: "APPROVED" }), c)).toBe(true);
  });

  it("REVIEWER does not see IN_REVIEW when domain view denied", () => {
    const c = ctx({
      roleByOrgId: new Map([[orgId, "REVIEWER"]]),
      domainViewByOrgDomain: new Map([["org1:REVENUE", false]]),
    });
    expect(canViewChangeWithContext(userId, row({ status: "IN_REVIEW" }), c)).toBe(false);
  });

  it("SUBMITTER sees own changes and APPROVED in domain", () => {
    const c = ctx({
      roleByOrgId: new Map([[orgId, "SUBMITTER"]]),
      domainViewByOrgDomain: new Map([["org1:REVENUE", true]]),
    });
    expect(canViewChangeWithContext(userId, row({ created_by: userId, status: "DRAFT" }), c)).toBe(true);
    expect(canViewChangeWithContext(userId, row({ created_by: userId, status: "IN_REVIEW" }), c)).toBe(true);
    expect(canViewChangeWithContext(userId, row({ created_by: "other", status: "APPROVED" }), c)).toBe(true);
    expect(canViewChangeWithContext(userId, row({ created_by: "other", status: "IN_REVIEW" }), c)).toBe(false);
  });

  it("VIEWER sees only APPROVED in domain", () => {
    const c = ctx({
      roleByOrgId: new Map([[orgId, "VIEWER"]]),
      domainViewByOrgDomain: new Map([["org1:REVENUE", true]]),
    });
    expect(canViewChangeWithContext(userId, row({ status: "APPROVED" }), c)).toBe(true);
    expect(canViewChangeWithContext(userId, row({ status: "IN_REVIEW" }), c)).toBe(false);
  });

  it("REVIEWER sees change when assigned even if domain view denied", () => {
    const c = ctx({
      roleByOrgId: new Map([[orgId, "REVIEWER"]]),
      assignedChangeIds: new Set(["c1"]),
      domainViewByOrgDomain: new Map([["org1:REVENUE", false]]),
    });
    expect(canViewChangeWithContext(userId, row({ id: "c1", status: "IN_REVIEW" }), c)).toBe(true);
  });
});
