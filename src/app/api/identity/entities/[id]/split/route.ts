/**
 * Phase 2 — POST /api/identity/entities/:id/split (§14.6).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { splitEntity } from "@/modules/identity/services/entitySplitService";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "Unauthorized" } }, { status: 401 });
  }

  const { id: entityId } = await params;
  let body: { orgId?: string; linkIdsToMove?: string[]; newEntityAttributes?: { displayName?: string }; notes?: string };
  try {
    body = (await req.json()) as { orgId?: string; linkIdsToMove?: string[]; newEntityAttributes?: { displayName?: string }; notes?: string };
  } catch {
    body = {};
  }
  const orgId = body.orgId ?? req.nextUrl.searchParams.get("orgId");
  const linkIdsToMove = body.linkIdsToMove ?? [];
  if (!orgId || linkIdsToMove.length === 0) {
    return NextResponse.json({ ok: false, error: { code: "bad_request", message: "orgId and linkIdsToMove[] required" } }, { status: 400 });
  }

  const { data: entity } = await supabase.from("canonical_entities").select("org_id").eq("id", entityId).single();
  if (!entity || (entity as { org_id: string }).org_id !== orgId) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Entity not found" } }, { status: 404 });
  }
  const { data: member } = await supabase.from("organization_members").select("org_id").eq("org_id", orgId).eq("user_id", userRes.user.id).maybeSingle();
  if (!member) {
    return NextResponse.json({ ok: false, error: { code: "forbidden", message: "Forbidden" } }, { status: 403 });
  }

  const result = await splitEntity(supabase, {
    entityId,
    linkIdsToMove,
    newEntityAttributes: body.newEntityAttributes ?? {},
    orgId,
    userId: userRes.user.id,
    notes: body.notes ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: { code: "split_failed", message: result.error } }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    data: { newEntityId: result.newEntityId },
    meta: { timestamp: new Date().toISOString() },
  });
}
