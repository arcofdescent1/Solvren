/**
 * Phase 3 — GET /api/admin/normalized-signals/:id (§15).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getNormalizedSignalById } from "@/modules/signals/persistence/normalized-signals.repository";
import { getSignalEntityLinksBySignalId } from "@/modules/signals/persistence/signal-entity-links.repository";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "Unauthorized" } }, { status: 401 });
  }

  const { id } = await params;
  const [signalRes, linksRes] = await Promise.all([
    getNormalizedSignalById(supabase, id),
    getSignalEntityLinksBySignalId(supabase, id),
  ]);
  if (signalRes.error) {
    return NextResponse.json({ ok: false, error: { code: "server_error", message: signalRes.error.message } }, { status: 500 });
  }
  if (!signalRes.data) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Not found" } }, { status: 404 });
  }

  const { data: memberships } = await supabase.from("organization_members").select("org_id").eq("user_id", userRes.user.id);
  const orgIds = (memberships ?? []).map((m) => (m as { org_id: string }).org_id);
  if (!orgIds.includes(signalRes.data.org_id)) {
    return NextResponse.json({ ok: false, error: { code: "forbidden", message: "Forbidden" } }, { status: 403 });
  }
  return NextResponse.json({
    ok: true,
    data: { ...signalRes.data, entityLinks: linksRes.data ?? [] },
    meta: { timestamp: new Date().toISOString() },
  });
}
