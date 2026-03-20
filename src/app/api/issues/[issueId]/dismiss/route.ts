import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { dismissIssue } from "@/modules/issues";
import { DismissIssueSchema } from "@/modules/issues/api/schemas";

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
  const parsed = DismissIssueSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });

  const result = await dismissIssue(supabase, issueId, auth.userId, parsed.data);
  if (result.error) {
    if (result.error === "Not found") return NextResponse.json({ error: result.error }, { status: 404 });
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const i = result.issue!;
  if (i.org_id !== auth.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({
    id: i.id,
    issueKey: i.issue_key,
    status: i.status,
    dismissedAt: i.dismissed_at,
    closedReason: i.closed_reason,
    updatedAt: i.updated_at,
  });
}
