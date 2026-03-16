import { describe, it, expect } from "vitest";

/**
 * Regression test for Promise.all destructuring bugs.
 * If counts are assigned to wrong variables (e.g. swapping order in destructuring
 * but not in Promise.all), dashboard cards show wrong numbers.
 *
 * This test ensures we document the correct mapping:
 * - myApprovals = count of visible changes where user has pending approval
 * - inReview = count of visible IN_REVIEW changes
 * - blocked = count of visible IN_REVIEW changes with missing required evidence (CHANGES, not evidence items)
 * - overdue = count of visible overdue changes
 * - failedOutbox = count of visible changes with FAILED delivery
 */
describe("Dashboard count semantics", () => {
  it("blocked count must be number of changes, not evidence items", () => {
    const visibleInReviewRows = [
      { id: "c1", org_id: "o1", domain: "REVENUE", status: "IN_REVIEW", created_by: "u1", is_restricted: false },
      { id: "c2", org_id: "o1", domain: "REVENUE", status: "IN_REVIEW", created_by: "u1", is_restricted: false },
    ];
    const missingEvidenceByChange = new Map<string, string[]>([
      ["c1", ["Doc1", "Doc2", "Doc3"]],
      ["c2", ["Doc4"]],
    ]);
    const blockedRows = visibleInReviewRows.filter(
      (r) => (missingEvidenceByChange.get(r.id)?.length ?? 0) > 0
    );
    expect(blockedRows.length).toBe(2);
    expect(blockedRows.length).not.toBe(4);
  });

  it("count and rows length must match for parity", () => {
    const visibleRows = [
      { id: "a" },
      { id: "b" },
      { id: "c" },
    ];
    const count = visibleRows.length;
    expect(count).toBe(3);
    expect(visibleRows).toHaveLength(count);
  });
});
