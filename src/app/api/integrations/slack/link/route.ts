import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId");
  if (!orgId)
    return NextResponse.json({ error: "Missing orgId" }, { status: 400 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data } = await supabase
    .from("slack_user_map")
    .select("slack_user_id")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    slackUserId: data?.slack_user_id ?? null,
  });
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    orgId?: string;
    slackUserId?: string;
  } | null;

  const orgId = body?.orgId?.trim();
  const slackUserId = body?.slackUserId?.trim();
  if (!orgId)
    return NextResponse.json(
      { error: "Missing orgId" },
      { status: 400 }
    );

  if (slackUserId && !/^U[A-Z0-9]+$/i.test(slackUserId))
    return NextResponse.json(
      { error: "Slack User ID should start with U (e.g. U01234ABC)" },
      { status: 400 }
    );

  const { data: member } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: install } = await admin
    .from("slack_installations")
    .select("team_id")
    .eq("org_id", orgId)
    .maybeSingle();

  if (!slackUserId) {
    const { error } = await admin
      .from("slack_user_map")
      .delete()
      .eq("org_id", orgId)
      .eq("user_id", userRes.user.id);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const slackTeamId = install?.team_id ?? "unknown";

  const { error } = await supabase.from("slack_user_map").upsert(
    {
      org_id: orgId,
      user_id: userRes.user.id,
      slack_team_id: slackTeamId,
      slack_user_id: slackUserId,
    },
    { onConflict: "org_id,user_id" }
  );

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
