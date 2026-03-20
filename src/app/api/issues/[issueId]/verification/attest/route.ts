import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getIssueDetail } from "@/modules/issues";
import { attestVerification } from "@/modules/verification";

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

  const { issue, error: issueErr } = await getIssueDetail(supabase, issueId);
  if (issueErr || !issue || issue.org_id !== auth.orgId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({})) as { summary?: string };
  const result = await attestVerification(supabase, issueId, auth.userId, body.summary ?? null);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({
    ok: true,
    runId: result.runId,
    verificationStatus: "passed",
    issueStatus: "verified",
  });
}
