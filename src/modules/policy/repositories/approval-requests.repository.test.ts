import { describe, expect, it } from "vitest";
import { approvalActionKeyMatchesPolicyAction } from "./approval-requests.repository";

describe("approvalActionKeyMatchesPolicyAction", () => {
  it("allows null approval key", () => {
    expect(approvalActionKeyMatchesPolicyAction(null, "stripe.refund")).toBe(true);
  });

  it("matches exact and provider-prefixed keys", () => {
    expect(approvalActionKeyMatchesPolicyAction("stripe.refund", "stripe.refund")).toBe(true);
    expect(approvalActionKeyMatchesPolicyAction("refund", "stripe.refund")).toBe(true);
  });

  it("rejects unrelated keys", () => {
    expect(approvalActionKeyMatchesPolicyAction("stripe.capture", "stripe.refund")).toBe(false);
  });
});
