import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getIssueDetail } from "@/modules/issues";

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
  return { orgId: membership?.org_id ?? null };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ issueId: string }> }
) {
  const { issueId } = await ctx.params;
  const supabase = await createServerSupabaseClient();
  const auth = await getAuth(supabase);
  if (!auth?.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { issue, error } = await getIssueDetail(supabase, issueId);
  if (error || !issue) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (issue.org_id !== auth.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: rows, error: histErr } = await supabase
    .from("issue_history")
    .select("id, event_type, event_actor_type, event_actor_ref, old_state_json, new_state_json, metadata_json, created_at")
    .eq("issue_id", issueId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (histErr) return NextResponse.json({ error: histErr.message }, { status: 500 });
  return NextResponse.json({
    issueId,
    history: (rows ?? []).map((r: { created_at: string; event_type: string }) => ({
      ...r,
      createdAt: r.created_at,
      eventType: r.event_type,
    })),
  });
}
