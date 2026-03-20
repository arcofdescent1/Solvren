import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { addIssueComment, getIssueDetail } from "@/modules/issues";
import { AddIssueCommentSchema } from "@/modules/issues/api/schemas";

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
  ctx: { params: Promise<{ issueId: string }> }
) {
  const { issueId } = await ctx.params;
  const supabase = await createServerSupabaseClient();
  const auth = await getAuth(supabase);
  if (!auth?.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = AddIssueCommentSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });

  const { issue, error: issueErr } = await getIssueDetail(supabase, issueId);
  if (issueErr || !issue || issue.org_id !== auth.orgId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await addIssueComment(
    supabase,
    issueId,
    auth.userId,
    parsed.data.body,
    parsed.data.visibility
  );
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true, message: "Comment added" });
}
