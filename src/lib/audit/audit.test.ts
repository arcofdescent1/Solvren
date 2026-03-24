import { describe, expect, it } from "vitest";
import { sanitizeAuditMetadata } from "@/lib/audit";

describe("sanitizeAuditMetadata", () => {
  it("removes secret-like keys", () => {
    const out = sanitizeAuditMetadata({
      foo: "bar",
      api_key: "should-drop",
      token: "x",
      nested: 1,
    });
    expect(out.foo).toBe("bar");
    expect(out.api_key).toBeUndefined();
    expect(out.token).toBeUndefined();
    expect(out.nested).toBe(1);
  });

  it("truncates very long strings", () => {
    const long = "x".repeat(3000);
    const out = sanitizeAuditMetadata({ body: long });
    expect(String(out.body).length).toBeLessThan(long.length);
    expect(String(out.body)).toContain("truncated");
  });
});
