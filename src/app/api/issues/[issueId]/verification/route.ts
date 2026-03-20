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

  const { data: runs, error: runsErr } = await supabase
    .from("verification_runs")
    .select("id, verification_type, status, started_at, completed_at, result_summary, result_json, triggered_by")
    .eq("issue_id", issueId)
    .order("started_at", { ascending: false })
    .limit(20);

  if (runsErr) return NextResponse.json({ error: runsErr.message }, { status: 500 });
  return NextResponse.json({
    issueId,
    verificationStatus: issue.verification_status,
    runs: (runs ?? []).map((r: { started_at: string; completed_at: string | null }) => ({
      ...r,
      startedAt: r.started_at,
      completedAt: r.completed_at,
    })),
  });
}
