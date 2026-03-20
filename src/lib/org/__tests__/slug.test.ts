import { describe, expect, it } from "vitest";
import { slugify, extractPrimaryDomain } from "../slug";

describe("slugify", () => {
  it("lowercases and hyphenates name", () => {
    expect(slugify("Acme Corp")).toBe("acme-corp");
    expect(slugify("My Organization")).toBe("my-organization");
  });

  it("strips leading/trailing hyphens", () => {
    expect(slugify("  Acme  ")).toBe("acme");
    expect(slugify("---Acme---")).toBe("acme");
  });

  it("replaces non-alphanumeric with single hyphen", () => {
    expect(slugify("Acme & Co.")).toBe("acme-co");
    expect(slugify("Test__Org")).toBe("test-org");
  });

  it("returns 'org' for empty or only-symbols input", () => {
    expect(slugify("")).toBe("org");
    expect(slugify("   ")).toBe("org");
    expect(slugify("---")).toBe("org");
  });

  it("handles single word", () => {
    expect(slugify("Acme")).toBe("acme");
  });
});

describe("extractPrimaryDomain", () => {
  it("extracts hostname from full URL", () => {
    expect(extractPrimaryDomain("https://acme.com")).toBe("acme.com");
    expect(extractPrimaryDomain("https://www.acme.com")).toBe("acme.com");
    expect(extractPrimaryDomain("https://sub.acme.com/path")).toBe("sub.acme.com");
  });

  it("strips www. prefix", () => {
    expect(extractPrimaryDomain("https://www.example.com")).toBe("example.com");
  });

  it("accepts URL without protocol", () => {
    expect(extractPrimaryDomain("acme.com")).toBe("acme.com");
    expect(extractPrimaryDomain("www.acme.com")).toBe("acme.com");
  });

  it("returns null for empty or invalid input", () => {
    expect(extractPrimaryDomain(null)).toBeNull();
    expect(extractPrimaryDomain(undefined)).toBeNull();
    expect(extractPrimaryDomain("")).toBeNull();
    expect(extractPrimaryDomain("   ")).toBeNull();
  });

  it("returns null for URL that throws (e.g. invalid host)", () => {
    expect(extractPrimaryDomain("http://[invalid")).toBeNull();
  });
});
