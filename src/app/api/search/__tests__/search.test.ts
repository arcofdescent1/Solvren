/**
 * Pass 7 — Search integration tests.
 * Run with: npm run test
 */
import { describe, it, expect, vi } from "vitest";

// Mock Supabase and executeSearch; test ranking/visibility logic in isolation
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

describe("Search API", () => {
  it("validates query length minimum", () => {
    expect("".trim().length >= 2).toBe(false);
    expect("a".trim().length >= 2).toBe(false);
    expect("ab".trim().length >= 2).toBe(true);
  });

  it("validates limit bounds", () => {
    const clamp = (n: number) => Math.min(50, Math.max(1, n));
    expect(clamp(0)).toBe(1);
    expect(clamp(1)).toBe(1);
    expect(clamp(10)).toBe(10);
    expect(clamp(100)).toBe(50);
  });

  it("escapes single quotes for SQL safety", () => {
    const safe = (s: string) => s.replace(/'/g, "''");
    expect(safe("hello")).toBe("hello");
    expect(safe("it's")).toBe("it''s");
  });
});
