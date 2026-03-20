/**
 * Phase 2 — POST /api/identity/match-candidates/:id/review (§14.4).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { reviewMatchCandidate } from "@/modules/identity/services/reviewQueueService";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "Unauthorized" } }, { status: 401 });
  }

  const { id: candidateId } = await params;
  let body: { decision?: string; canonicalEntityId?: string; notes?: string };
  try {
    body = (await req.json()) as { decision?: string; canonicalEntityId?: string; notes?: string };
  } catch {
    body = {};
  }
  const decision = body.decision as "accept_existing" | "create_new" | "reject" | undefined;
  if (!decision || !["accept_existing", "create_new", "reject"].includes(decision)) {
    return NextResponse.json({ ok: false, error: { code: "bad_request", message: "decision required: accept_existing | create_new | reject" } }, { status: 400 });
  }

  const { data: candidate } = await supabase.from("entity_match_candidates").select("org_id").eq("id", candidateId).single();
  if (!candidate) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Candidate not found" } }, { status: 404 });
  }
  const orgId = (candidate as { org_id: string }).org_id;
  const { data: member } = await supabase.from("organization_members").select("org_id").eq("org_id", orgId).eq("user_id", userRes.user.id).maybeSingle();
  if (!member) {
    return NextResponse.json({ ok: false, error: { code: "forbidden", message: "Forbidden" } }, { status: 403 });
  }

  const result = await reviewMatchCandidate(supabase, {
    candidateId,
    decision,
    canonicalEntityId: body.canonicalEntityId ?? null,
    notes: body.notes ?? null,
    userId: userRes.user.id,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: { code: "review_failed", message: result.error } }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    data: { canonicalEntityId: result.canonicalEntityId },
    meta: { timestamp: new Date().toISOString() },
  });
}
