import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { authzErrorResponse, requireOrgPermission } from "@/lib/server/authz";
import { executeIssueWorkflowAction } from "@/lib/issues/executeIssueWorkflowAction";
import { createAdminClient } from "@/lib/supabase/admin";
import { permissionForIssueWorkflowAction } from "@/lib/issues/issueActionPermission";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ issueId: string }> }
) {
  try {
    const { issueId } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { note?: string };
    const supabase = await createServerSupabaseClient();
    const admin = createAdminClient();

    const { data: issue, error: loadErr } = await supabase
      .from("issues")
      .select("id, org_id")
      .eq("id", issueId)
      .maybeSingle();

    if (loadErr || !issue) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }

    const orgId = (issue as { org_id: string }).org_id;
    const auth = await requireOrgPermission(orgId, permissionForIssueWorkflowAction("acknowledge"));

    const r = await executeIssueWorkflowAction(admin, {
      issueId,
      actorUserId: auth.user.id,
      actorEmail: auth.user.email ?? null,
      actorDisplayName: null,
      source: "solvren_app",
      action: "acknowledge",
      payload: { note: body.note ?? null },
    });

    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });

    return NextResponse.json(r);
  } catch (e) {
    return authzErrorResponse(e);
  }
}
