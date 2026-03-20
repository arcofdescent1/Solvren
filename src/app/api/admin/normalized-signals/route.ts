/**
 * Phase 3 — GET /api/admin/normalized-signals (§15).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listNormalizedSignals } from "@/modules/signals/persistence/normalized-signals.repository";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "Unauthorized" } }, { status: 401 });
  }

  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ ok: false, error: { code: "bad_request", message: "orgId required" } }, { status: 400 });
  }

  const { data: memberships } = await supabase.from("organization_members").select("org_id").eq("user_id", userRes.user.id);
  const orgIds = (memberships ?? []).map((m) => (m as { org_id: string }).org_id);
  if (!orgIds.includes(orgId)) {
    return NextResponse.json({ ok: false, error: { code: "forbidden", message: "Forbidden" } }, { status: 403 });
  }

  const { data, error } = await listNormalizedSignals(supabase, {
    orgId,
    signalKey: url.searchParams.get("signalKey") ?? undefined,
    provider: url.searchParams.get("provider") ?? undefined,
    primaryEntityId: url.searchParams.get("primaryEntityId") ?? undefined,
    fromTime: url.searchParams.get("fromTime") ?? undefined,
    toTime: url.searchParams.get("toTime") ?? undefined,
    limit: parseInt(url.searchParams.get("limit") ?? "20", 10),
    offset: parseInt(url.searchParams.get("offset") ?? "0", 10),
  });
  if (error) {
    return NextResponse.json({ ok: false, error: { code: "server_error", message: error.message } }, { status: 500 });
  }
  return NextResponse.json({ ok: true, data, meta: { timestamp: new Date().toISOString() } });
}
