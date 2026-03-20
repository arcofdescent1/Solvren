/**
 * Phase 2 — POST /api/identity/links/:id/unlink (§14.7).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { unlinkExternalObject } from "@/modules/identity/services/unlinkService";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "Unauthorized" } }, { status: 401 });
  }

  const { id: linkId } = await params;
  let body: { orgId?: string; reason?: string };
  try {
    body = (await req.json()) as { orgId?: string; reason?: string };
  } catch {
    body = {};
  }
  const orgId = body.orgId ?? req.nextUrl.searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ ok: false, error: { code: "bad_request", message: "orgId required" } }, { status: 400 });
  }

  const { data: link } = await supabase.from("entity_links").select("org_id").eq("id", linkId).single();
  if (!link || (link as { org_id: string }).org_id !== orgId) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Link not found" } }, { status: 404 });
  }
  const { data: member } = await supabase.from("organization_members").select("org_id").eq("org_id", orgId).eq("user_id", userRes.user.id).maybeSingle();
  if (!member) {
    return NextResponse.json({ ok: false, error: { code: "forbidden", message: "Forbidden" } }, { status: 403 });
  }

  const result = await unlinkExternalObject(supabase, {
    linkId,
    orgId,
    reason: body.reason ?? null,
    userId: userRes.user.id,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: { code: "unlink_failed", message: result.error } }, { status: 400 });
  }
  return NextResponse.json({ ok: true, data: { unlinked: true }, meta: { timestamp: new Date().toISOString() } });
}
