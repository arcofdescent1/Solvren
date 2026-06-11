import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { isDemoWriteAllowedRequest } from "./demoWritePolicy";

function request(method: string, pathname: string) {
  return new NextRequest(new URL(pathname, "https://www.solvren.com"), { method });
}

describe("isDemoWriteAllowedRequest", () => {
  it("allows profile avatar uploads in demo workspaces", () => {
    expect(isDemoWriteAllowedRequest(request("POST", "/api/profile/avatar"))).toBe(true);
  });

  it("allows profile metadata updates in demo workspaces", () => {
    expect(isDemoWriteAllowedRequest(request("PATCH", "/api/profile"))).toBe(true);
  });

  it("continues blocking unrelated demo writes", () => {
    expect(isDemoWriteAllowedRequest(request("POST", "/api/changes/draft"))).toBe(false);
  });
});
