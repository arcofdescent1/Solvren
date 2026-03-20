import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getIssueDetail } from "@/modules/issues";
import { startVerificationRun, type VerificationType } from "@/modules/verification";

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

const VALID_TYPES: VerificationType[] = ["rule_recheck", "integration_probe", "manual_attestation", "metric_delta"];

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

  const body = await req.json().catch(() => ({})) as { verificationType?: string };
  const verificationType = (body.verificationType ?? "rule_recheck") as VerificationType;
  if (!VALID_TYPES.includes(verificationType))
    return NextResponse.json({ error: "Invalid verificationType" }, { status: 400 });

  const result = await startVerificationRun(supabase, issueId, verificationType, auth.userId);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ runId: result.runId, status: "running" });
}
