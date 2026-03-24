import { NextResponse } from "next/server";
import { z } from "zod";
import { createPrivilegedClient } from "@/lib/server/adminClient";
import { authzErrorResponse, parseRequestedOrgId, requireOrgMembership } from "@/lib/server/authz";

const postBodySchema = z.object({
  orgId: z.string().uuid(),
  slack_user_id: z.string().min(1),
});

const deleteBodySchema = z.object({
  orgId: z.string().uuid(),
});

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => null);
    const parsed = postBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "orgId and slack_user_id required" }, { status: 400 });
    }
    const orgId = parseRequestedOrgId(parsed.data.orgId);
    const ctx = await requireOrgMembership(orgId);

    const admin = createPrivilegedClient("POST /api/slack/user-map: read slack_installations.team_id");
    const { data: install } = await admin
      .from("slack_installations")
      .select("team_id")
      .eq("org_id", orgId)
      .maybeSingle();

    const slackTeamId = install?.team_id ?? "unknown";

    const { error } = await ctx.supabase.from("slack_user_map").upsert(
      {
        org_id: orgId,
        user_id: ctx.user.id,
        slack_team_id: slackTeamId,
        slack_user_id: parsed.data.slack_user_id,
      },
      { onConflict: "org_id,user_id" }
    );

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return authzErrorResponse(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const raw = await req.json().catch(() => null);
    const parsed = deleteBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "orgId required" }, { status: 400 });
    }
    const orgId = parseRequestedOrgId(parsed.data.orgId);
    const ctx = await requireOrgMembership(orgId);

    const admin = createPrivilegedClient("DELETE /api/slack/user-map: delete mapping row");
    const { error } = await admin.from("slack_user_map").delete().eq("org_id", orgId).eq("user_id", ctx.user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
