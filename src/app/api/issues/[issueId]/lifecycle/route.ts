/**
 * Phase 1 — GET /api/issues/:issueId/lifecycle
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getLifecycle } from "@/modules/issues/lifecycle/services/issue-lifecycle.service";
import { getMissingClosureRequirements } from "@/modules/issues/lifecycle/services/issue-closure.service";
import { selectIssueById } from "@/modules/issues/infrastructure/issueRepository";

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

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ issueId: string }> }
) {
  const { issueId } = await ctx.params;
  const supabase = await createServerSupabaseClient();
  const auth = await getAuth(supabase);
  if (!auth?.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: issue } = await selectIssueById(supabase, issueId);
  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (issue.org_id !== auth.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await getLifecycle(supabase, issueId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const missingRequirements = await getMissingClosureRequirements(supabase, issueId);

  return NextResponse.json({ ...data, missingRequirements });
}
