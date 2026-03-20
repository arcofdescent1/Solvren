import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { executeSearch } from "@/services/search/searchService";

/**
 * Pass 7 — Search API.
 * GET /api/search?q=query&limit=10&page=1&types=changes,systems,approvals,evidence,users
 * Returns grouped, visibility-filtered results. Respects org, RBAC, domain permissions, restricted.
 */
export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = user.id;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10", 10)));
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const entityTypes = url.searchParams.get("types")?.split(",").filter(Boolean) ?? [
    "changes",
    "issues",
    "systems",
    "approvals",
    "evidence",
  ];
  const status = url.searchParams.get("status") ?? undefined;
  const system = url.searchParams.get("system") ?? undefined;
  const changeType = url.searchParams.get("changeType") ?? undefined;
  const domain = url.searchParams.get("domain") ?? undefined;

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userId);
  const orgIds = (memberships ?? []).map((m) => m.org_id);

  if (!orgIds.length) {
    return NextResponse.json({
      ok: true,
      q,
      changes: [],
      issues: [],
      systems: [],
      approvals: [],
      evidence: [],
      users: [],
      totalChanges: 0,
      totalIssues: 0,
      totalSystems: 0,
      totalApprovals: 0,
      totalEvidence: 0,
      totalUsers: 0,
    });
  }

  const result = await executeSearch(supabase, userId, orgIds, {
    q,
    limit,
    page,
    entityTypes,
    status,
    system,
    changeType,
    domain,
  });

  return NextResponse.json({
    ok: true,
    q,
    changes: result.changes,
    issues: result.issues,
    systems: result.systems,
    approvals: result.approvals,
    evidence: result.evidence,
    users: result.users,
    totalChanges: result.changes.length,
    totalIssues: result.issues.length,
    totalSystems: result.systems.length,
    totalApprovals: result.approvals.length,
    totalEvidence: result.evidence.length,
    totalUsers: result.users.length,
  });
}
