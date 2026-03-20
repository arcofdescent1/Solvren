/**
 * Phase 2 — POST /api/identity/entities/merge (§14.5).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { mergeEntities } from "@/modules/identity/services/entityMergeService";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "Unauthorized" } }, { status: 401 });
  }

  let body: { sourceEntityIds?: string[]; targetEntityId?: string; orgId?: string; notes?: string };
  try {
    body = (await req.json()) as { sourceEntityIds?: string[]; targetEntityId?: string; orgId?: string; notes?: string };
  } catch {
    body = {};
  }
  const sourceEntityIds = body.sourceEntityIds ?? [];
  const targetEntityId = body.targetEntityId;
  const orgId = body.orgId;
  if (!orgId || !targetEntityId || sourceEntityIds.length === 0) {
    return NextResponse.json({ ok: false, error: { code: "bad_request", message: "orgId, targetEntityId, and sourceEntityIds[] required" } }, { status: 400 });
  }

  const { data: member } = await supabase.from("organization_members").select("org_id").eq("org_id", orgId).eq("user_id", userRes.user.id).maybeSingle();
  if (!member) {
    return NextResponse.json({ ok: false, error: { code: "forbidden", message: "Forbidden" } }, { status: 403 });
  }

  const result = await mergeEntities(supabase, {
    sourceEntityIds,
    targetEntityId,
    orgId,
    userId: userRes.user.id,
    notes: body.notes ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: { code: "merge_failed", message: result.error } }, { status: 400 });
  }
  return NextResponse.json({ ok: true, data: { merged: true }, meta: { timestamp: new Date().toISOString() } });
}
