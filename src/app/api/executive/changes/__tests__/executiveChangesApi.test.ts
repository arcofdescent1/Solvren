import { describe, it, expect, vi, beforeEach } from "vitest";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { canViewChange } from "@/lib/access/changeAccess";
import { isExecutiveUserForPhase1 } from "@/lib/rbac/isExecutiveUserForPhase1";
import { buildExecutiveChangeView } from "@/lib/executive/buildExecutiveChangeView";
import { persistExecutiveDecision } from "@/lib/executive/persistExecutiveDecision";
import { GET } from "../[id]/route";
import { POST } from "../[id]/decision/route";

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/access/changeAccess", () => ({
  canViewChange: vi.fn(),
}));

vi.mock("@/lib/rbac/isExecutiveUserForPhase1", () => ({
  isExecutiveUserForPhase1: vi.fn(),
}));

vi.mock("@/lib/executive/buildExecutiveChangeView", () => ({
  buildExecutiveChangeView: vi.fn(),
}));

vi.mock("@/lib/executive/persistExecutiveDecision", () => ({
  persistExecutiveDecision: vi.fn(),
}));

const verifiedUser = {
  id: "user-1",
  email: "exec@example.com",
  email_confirmed_at: "2024-01-01T00:00:00.000Z",
};

function mockSupabaseForChange(change: Record<string, unknown> | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: change, error: null });
  const afterIs = { eq: vi.fn().mockReturnThis(), maybeSingle };
  const selectReturn = { is: vi.fn().mockReturnValue(afterIs) };
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: verifiedUser } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue(selectReturn),
    }),
  };
}

describe("GET /api/executive/changes/[id]", () => {
  beforeEach(() => {
    vi.mocked(canViewChange).mockReset();
    vi.mocked(isExecutiveUserForPhase1).mockReset();
    vi.mocked(buildExecutiveChangeView).mockReset();
  });

  it("returns 401 when there is no session user", async () => {
    const supabase = mockSupabaseForChange({
      id: "c1",
      org_id: "o1",
      domain: "engineering",
      status: "draft",
      created_by: "user-1",
      is_restricted: false,
    });
    supabase.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null } });
    vi.mocked(createServerSupabaseClient).mockResolvedValue(supabase as never);

    const res = await GET(new Request("http://localhost/api"), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 for unverified email", async () => {
    const supabase = mockSupabaseForChange(null);
    supabase.auth.getUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: "u1",
          email: "x@y.com",
          email_confirmed_at: null,
        },
      },
    });
    vi.mocked(createServerSupabaseClient).mockResolvedValue(supabase as never);

    const res = await GET(new Request("http://localhost/api"), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 403 when user can view but is not executive", async () => {
    const row = {
      id: "c1",
      org_id: "o1",
      domain: "engineering",
      status: "draft",
      created_by: "user-1",
      is_restricted: false,
    };
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      mockSupabaseForChange(row) as never
    );
    vi.mocked(canViewChange).mockResolvedValue(true);
    vi.mocked(isExecutiveUserForPhase1).mockResolvedValue(false);

    const res = await GET(new Request("http://localhost/api"), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns executive view JSON for executive user", async () => {
    const row = {
      id: "c1",
      org_id: "o1",
      domain: "engineering",
      status: "draft",
      created_by: "user-1",
      is_restricted: false,
    };
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      mockSupabaseForChange(row) as never
    );
    vi.mocked(canViewChange).mockResolvedValue(true);
    vi.mocked(isExecutiveUserForPhase1).mockResolvedValue(true);
    vi.mocked(buildExecutiveChangeView).mockResolvedValue({
      id: "c1",
      title: "Ship feature",
    } as never);

    const res = await GET(new Request("http://localhost/api"), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.title).toBe("Ship feature");
  });
});

describe("POST /api/executive/changes/[id]/decision", () => {
  beforeEach(() => {
    vi.mocked(canViewChange).mockReset();
    vi.mocked(isExecutiveUserForPhase1).mockReset();
    vi.mocked(persistExecutiveDecision).mockReset();
  });

  it("returns 400 for invalid decision", async () => {
    const row = {
      id: "c1",
      org_id: "o1",
      domain: "engineering",
      status: "draft",
      created_by: "user-1",
      is_restricted: false,
    };
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      mockSupabaseForChange(row) as never
    );
    vi.mocked(canViewChange).mockResolvedValue(true);
    vi.mocked(isExecutiveUserForPhase1).mockResolvedValue(true);

    const res = await POST(
      new Request("http://localhost/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "NOT_A_REAL_DECISION" }),
      }),
      { params: Promise.resolve({ id: "c1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("returns 403 when not executive", async () => {
    const row = {
      id: "c1",
      org_id: "o1",
      domain: "engineering",
      status: "draft",
      created_by: "user-1",
      is_restricted: false,
    };
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      mockSupabaseForChange(row) as never
    );
    vi.mocked(canViewChange).mockResolvedValue(true);
    vi.mocked(isExecutiveUserForPhase1).mockResolvedValue(false);

    const res = await POST(
      new Request("http://localhost/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "DELAY", comment: "wait" }),
      }),
      { params: Promise.resolve({ id: "c1" }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 409 when persist reports executive approval blocked", async () => {
    const row = {
      id: "c1",
      org_id: "o1",
      domain: "engineering",
      status: "draft",
      created_by: "user-1",
      is_restricted: false,
    };
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      mockSupabaseForChange(row) as never
    );
    vi.mocked(canViewChange).mockResolvedValue(true);
    vi.mocked(isExecutiveUserForPhase1).mockResolvedValue(true);
    vi.mocked(persistExecutiveDecision).mockResolvedValue({
      ok: false,
      status: 409,
      body: {
        error: "EXECUTIVE_APPROVAL_BLOCKED",
        reasons: ["Rollback Plan is BLOCKED"],
      },
    });

    const res = await POST(
      new Request("http://localhost/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "APPROVE" }),
      }),
      { params: Promise.resolve({ id: "c1" }) }
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("EXECUTIVE_APPROVAL_BLOCKED");
    expect(json.reasons).toContain("Rollback Plan is BLOCKED");
  });

  it("returns 200 when decision is persisted", async () => {
    const row = {
      id: "c1",
      org_id: "o1",
      domain: "engineering",
      status: "draft",
      created_by: "user-1",
      is_restricted: false,
    };
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      mockSupabaseForChange(row) as never
    );
    vi.mocked(canViewChange).mockResolvedValue(true);
    vi.mocked(isExecutiveUserForPhase1).mockResolvedValue(true);
    vi.mocked(persistExecutiveDecision).mockResolvedValue({ ok: true });

    const res = await POST(
      new Request("http://localhost/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "ESCALATE", comment: "need visibility" }),
      }),
      { params: Promise.resolve({ id: "c1" }) }
    );
    expect(res.status).toBe(200);
  });
});
