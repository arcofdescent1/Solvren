import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { linkChangeToIssue } from "@/modules/change-governance";
import { createIssueFromSource } from "@/modules/issues";
import type { ChangeIssueLinkType } from "@/modules/change-governance";

async function getAuth(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return null;
  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return { userId: userRes.user.id, orgId: membership?.org_id ?? null };
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: changeId } = await ctx.params;
  const supabase = await createServerSupabaseClient();
  const auth = await getAuth(supabase);
  if (!auth?.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    issueId?: string;
    linkType?: ChangeIssueLinkType;
    createIssue?: boolean;
  };

  const linkType = (body.linkType ?? "origin") as ChangeIssueLinkType;
  const validLinkTypes: ChangeIssueLinkType[] = ["origin", "related", "caused", "mitigates", "blocked_by"];
  if (!validLinkTypes.includes(linkType))
    return NextResponse.json({ error: "Invalid linkType" }, { status: 400 });

  if (body.createIssue === true) {
    const { data: change } = await scopeActiveChangeEvents(supabase.from("change_events").select("id, org_id, title, domain"))
      .eq("id", changeId)
      .single();
    if (!change || change.org_id !== auth.orgId)
      return NextResponse.json({ error: "Change not found" }, { status: 404 });

    const { issue, error: createErr } = await createIssueFromSource(supabase, {
      org_id: auth.orgId,
      source_type: "change",
      source_ref: changeId,
      domain_key: (change as { domain?: string }).domain ?? "revenue",
      title: `Change: ${(change as { title?: string }).title ?? changeId.slice(0, 8)}`,
      created_by: auth.userId,
    });
    if (createErr || !issue) return NextResponse.json({ error: createErr ?? "Create failed" }, { status: 500 });

    const result = await linkChangeToIssue(supabase, changeId, issue.id, linkType);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({
      ok: true,
      issueId: issue.id,
      issueKey: issue.issue_key,
      linkType,
    });
  }

  const issueId = body.issueId;
  if (!issueId || typeof issueId !== "string")
    return NextResponse.json({ error: "issueId required when createIssue is not true" }, { status: 400 });

  const result = await linkChangeToIssue(supabase, changeId, issueId, linkType);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, issueId, linkType });
}
