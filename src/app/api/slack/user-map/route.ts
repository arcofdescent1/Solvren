import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const orgId = body?.orgId as string | undefined;
  const slackUserId = body?.slack_user_id as string | undefined;

  if (!orgId || !slackUserId) {
    return NextResponse.json(
      { error: "orgId and slack_user_id required" },
      { status: 400 }
    );
  }

  const { data: member } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data: install } = await admin
    .from("slack_installations")
    .select("team_id")
    .eq("org_id", orgId)
    .maybeSingle();

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
    return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const orgId = body?.orgId as string | undefined;
  if (!orgId)
    return NextResponse.json(
      { error: "orgId required" },
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

  const admin = createAdminClient();
  const { error } = await admin
    .from("slack_user_map")
    .delete()
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
