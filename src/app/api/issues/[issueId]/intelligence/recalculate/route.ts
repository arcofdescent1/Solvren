import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, requireOrgPermission } from "@/lib/server/authz";
import { scoreIssue } from "@/lib/issues/issueIntelligenceService";
import { isAdminLikeRole } from "@/lib/rbac/roles";

export async function POST(_req: Request, ctx: { params: Promise<{ issueId: string }> }) {
  try {
    const { issueId } = await ctx.params;
    const supabase = await createServerSupabaseClient();

    const { data: issue, error: le } = await supabase
      .from("issues")
      .select("org_id")
      .eq("id", issueId)
      .maybeSingle();

    if (le || !issue) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const orgId = (issue as { org_id: string }).org_id;
    const auth = await requireOrgPermission(orgId, "issues.view");

    if (!isAdminLikeRole(auth.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();
    const r = await scoreIssue(admin, issueId);
    if (!r.ok) return NextResponse.json({ error: r.error ?? "score failed" }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
