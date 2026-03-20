/**
 * Phase 2 — GET /api/identity/match-candidates (§14.3).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listMatchCandidates } from "@/modules/identity/repositories/matchCandidateRepository";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "Unauthorized" } }, { status: 401 });
  }

  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId");
  const reviewStatus = url.searchParams.get("reviewStatus") ?? undefined;
  const proposedEntityType = url.searchParams.get("entityType") ?? undefined;
  const minConfidence = url.searchParams.get("minConfidence");
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10) || 50);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10) || 0;

  if (!orgId) {
    return NextResponse.json({ ok: false, error: { code: "bad_request", message: "orgId required" } }, { status: 400 });
  }

  const { data: memberships } = await supabase.from("organization_members").select("org_id").eq("user_id", userRes.user.id);
  const orgIds = (memberships ?? []).map((m) => (m as { org_id: string }).org_id);
  if (!orgIds.includes(orgId)) {
    return NextResponse.json({ ok: false, error: { code: "forbidden", message: "Forbidden" } }, { status: 403 });
  }

  const { data: candidates, error } = await listMatchCandidates(supabase, {
    orgId,
    reviewStatus,
    proposedEntityType,
    minConfidence: minConfidence != null ? parseFloat(minConfidence) : undefined,
    limit,
    offset,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: { code: "server_error", message: error.message } }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    data: candidates,
    meta: { timestamp: new Date().toISOString() },
  });
}
