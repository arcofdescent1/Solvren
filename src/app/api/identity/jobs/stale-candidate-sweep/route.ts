/**
 * Phase 2 — POST /api/identity/jobs/stale-candidate-sweep
 * Auth: user org admin OR cron secret.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireCronSecret } from "@/lib/cronAuth";
import { runStaleCandidateSweepJob } from "@/modules/identity/jobs/staleCandidateSweepJob";

export async function POST(req: NextRequest) {
  const cronFailed = requireCronSecret(req);
  const supabase = await createServerSupabaseClient();
  let body: { orgId: string; staleDays?: number; limit?: number };
  try {
    body = (await req.json()) as { orgId: string; staleDays?: number; limit?: number };
  } catch {
    body = { orgId: "" };
  }
  if (!body.orgId) {
    return NextResponse.json({ ok: false, error: { code: "bad_request", message: "orgId required" } }, { status: 400 });
  }
  if (cronFailed) {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return cronFailed;
    const { data: member } = await supabase
      .from("organization_members")
      .select("role")
      .eq("org_id", body.orgId)
      .eq("user_id", userRes.user.id)
      .maybeSingle();
    const { isAdminLikeRole, parseOrgRole } = await import("@/lib/rbac/roles");
    if (!member || !isAdminLikeRole(parseOrgRole((member as { role: string | null }).role ?? null))) {
      return NextResponse.json({ ok: false, error: { code: "forbidden", message: "Forbidden" } }, { status: 403 });
    }
  }
  const result = await runStaleCandidateSweepJob(supabase, {
    orgId: body.orgId,
    staleDays: body.staleDays,
    limit: body.limit,
  });
  return NextResponse.json({ ok: true, data: result });
}
