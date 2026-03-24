import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertSuggestionAllowedForPolicy } from "./guardrails";
import * as policiesRepo from "@/modules/policy/repositories/policies.repository";

vi.mock("@/modules/policy/repositories/policies.repository", () => ({
  getPolicyById: vi.fn(),
}));

describe("assertSuggestionAllowedForPolicy", () => {
  const supabase = {} as SupabaseClient;

  beforeEach(() => {
    vi.mocked(policiesRepo.getPolicyById).mockReset();
  });

  it("allows null policy id", async () => {
    const r = await assertSuggestionAllowedForPolicy(supabase, null);
    expect(r.ok).toBe(true);
  });

  it("blocks platform non-relaxable policies", async () => {
    vi.mocked(policiesRepo.getPolicyById).mockResolvedValue({
      data: {
        id: "p1",
        policy_owner_type: "PLATFORM",
        relaxation_mode: "NON_RELAXABLE",
      },
      error: null,
    } as never);

    const r = await assertSuggestionAllowedForPolicy(supabase, "p1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/non-relaxable/i);
  });

  it("allows org-owned policies", async () => {
    vi.mocked(policiesRepo.getPolicyById).mockResolvedValue({
      data: {
        id: "p2",
        policy_owner_type: "ORG",
        relaxation_mode: "RELAXABLE",
      },
      error: null,
    } as never);

    const r = await assertSuggestionAllowedForPolicy(supabase, "p2");
    expect(r.ok).toBe(true);
  });
});
