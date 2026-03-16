import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { addTimelineEvent } from "@/services/timeline/addTimelineEvent";
import { enqueueNotificationEvents } from "@/services/notifications/createNotifications";
import { canRole } from "@/lib/rbac/permissions";
import { parseOrgRole } from "@/lib/rbac/roles";
import { canViewChange } from "@/lib/access/changeAccess";

type Body = { text: string };

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "Comment text required" }, { status: 400 });
  if (text.length > 2000) return NextResponse.json({ error: "Comment too long" }, { status: 400 });

  const { id: changeId } = await ctx.params;

  const { data: change, error: chErr } = await supabase
    .from("change_events")
    .select("id, org_id, domain, status, created_by, is_restricted")
    .eq("id", changeId)
    .single();

  if (chErr || !change)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canView = await canViewChange(supabase, userRes.user.id, change);
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("org_id, role")
    .eq("org_id", change.org_id)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!canRole(parseOrgRole((member as { role?: string | null }).role ?? null), "change.comment")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const preview = text.length > 80 ? text.slice(0, 80) + "…" : text;

  await addTimelineEvent({
    supabase,
    orgId: change.org_id,
    changeEventId: changeId,
    actorUserId: userRes.user.id,
    eventType: "COMMENT_ADDED",
    title: "Comment added",
    description: `${userRes.user.email ?? "User"} added a comment`,
    metadata: { text },
  });

  const admin = createAdminClient();
  const { data: changeRow } = await admin
    .from("change_events")
    .select("title")
    .eq("id", changeId)
    .single();
  const commentPreview = text.length > 80 ? text.slice(0, 80) + "…" : text;
  await enqueueNotificationEvents(admin, {
    orgId: change.org_id,
    changeEventId: changeId,
    templateKey: "comment_added",
    payload: {
      title: changeRow?.title ?? null,
      commentPreview,
      actorUserId: userRes.user.id,
    },
    channels: ["IN_APP", "SLACK", "EMAIL"],
  });

  return NextResponse.json({ ok: true, preview });
}
