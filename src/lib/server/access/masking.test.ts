import { describe, expect, it } from "vitest";
import { sanitizeSupportAccessReason } from "./support-access-notifications";
import { projectCustomerRecord } from "./masking";

describe("projectCustomerRecord", () => {
  it("strips secret-like keys in sensitive star mode", () => {
    const out = projectCustomerRecord("issue", "sensitive", {
      id: "1",
      status: "open",
      access_token: "x",
      title: "hello",
    } as Record<string, unknown>);
    expect(out.access_token).toBeUndefined();
    expect(out.id).toBe("1");
  });

  it("metadata issue only allowlisted keys", () => {
    const out = projectCustomerRecord("issue", "metadata", {
      id: "1",
      status: "open",
      title: "secret title",
    } as Record<string, unknown>);
    expect(out.title).toBeUndefined();
    expect(out.id).toBe("1");
  });
});

describe("sanitizeSupportAccessReason", () => {
  it("truncates and strips angle brackets", () => {
    expect(sanitizeSupportAccessReason("<script>x</script>" + "a".repeat(200)).length).toBeLessThanOrEqual(120);
    expect(sanitizeSupportAccessReason("ok")).toBe("ok");
  });
});
