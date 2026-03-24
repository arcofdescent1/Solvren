import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";

export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.view");

    const { data } = await ctx.supabase
      .from("slack_user_map")
      .select("slack_user_id")
      .eq("org_id", ctx.orgId)
      .eq("user_id", ctx.user.id)
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      slackUserId: data?.slack_user_id ?? null,
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      orgId?: string;
      slackUserId?: string;
    } | null;

    const orgId = body?.orgId?.trim();
    const slackUserId = body?.slackUserId?.trim();
    if (!orgId) return NextResponse.json({ error: "Missing orgId" }, { status: 400 });

    if (slackUserId && !/^U[A-Z0-9]+$/i.test(slackUserId))
      return NextResponse.json(
        { error: "Slack User ID should start with U (e.g. U01234ABC)" },
        { status: 400 }
      );

    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.manage");
    const admin = createAdminClient();

    const { data: install } = await admin
      .from("slack_installations")
      .select("team_id")
      .eq("org_id", ctx.orgId)
      .maybeSingle();

    if (!slackUserId) {
      const { error } = await admin
        .from("slack_user_map")
        .delete()
        .eq("org_id", ctx.orgId)
        .eq("user_id", ctx.user.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    const slackTeamId = install?.team_id ?? "unknown";

    const { error } = await ctx.supabase.from("slack_user_map").upsert(
      {
        org_id: ctx.orgId,
        user_id: ctx.user.id,
        slack_team_id: slackTeamId,
        slack_user_id: slackUserId,
      },
      { onConflict: "org_id,user_id" }
    );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
