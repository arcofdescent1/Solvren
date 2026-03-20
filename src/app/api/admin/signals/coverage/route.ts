/**
 * Phase 3 — GET /api/admin/signals/coverage (§15).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    rawByProvider,
    normByProvider,
    topSignalsRes,
    unmappedRes,
    deadLetterRes,
    raw24hRes,
    raw7dRes,
    raw30dRes,
    norm24hRes,
    norm7dRes,
    norm30dRes,
  ] = await Promise.all([
    supabase.from("raw_events").select("provider").eq("org_id", orgId),
    supabase.from("normalized_signals").select("provider").eq("org_id", orgId),
    supabase.from("normalized_signals").select("signal_key").eq("org_id", orgId),
    supabase.from("raw_events").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("processing_status", "processed").is("mapper_key", null),
    supabase.from("dead_letter_events").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "pending"),
    supabase.from("raw_events").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("received_at", dayAgo),
    supabase.from("raw_events").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("received_at", weekAgo),
    supabase.from("raw_events").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("received_at", monthAgo),
    supabase.from("normalized_signals").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("signal_time", dayAgo),
    supabase.from("normalized_signals").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("signal_time", weekAgo),
    supabase.from("normalized_signals").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("signal_time", monthAgo),
  ]);

  const byProvider = (rows: { provider: string }[]) => {
    const m: Record<string, number> = {};
    for (const r of rows ?? []) m[r.provider] = (m[r.provider] ?? 0) + 1;
    return m;
  };
  const bySignalKey = (rows: { signal_key: string }[]) => {
    const m: Record<string, number> = {};
    for (const r of rows ?? []) m[r.signal_key] = (m[r.signal_key] ?? 0) + 1;
    return m;
  };
  const top = Object.entries(bySignalKey((topSignalsRes.data as { signal_key: string }[]) ?? []))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([k, v]) => ({ signalKey: k, count: v }));

  const rawData = (rawByProvider.data as { provider: string }[]) ?? [];
  const normData = (normByProvider.data as { provider: string }[]) ?? [];

  return NextResponse.json({
    ok: true,
    data: {
      rawEventsByProvider: byProvider(rawData),
      normalizedSignalsByProvider: byProvider(normData),
      totalRawEvents: rawData.length,
      totalNormalizedSignals: normData.length,
      unmappedCount: (unmappedRes as { count?: number }).count ?? 0,
      deadLetterCount: (deadLetterRes as { count?: number }).count ?? 0,
      topSignalKeys: top,
      last24h: { raw: (raw24hRes as { count?: number }).count ?? 0, normalized: (norm24hRes as { count?: number }).count ?? 0 },
      last7d: { raw: (raw7dRes as { count?: number }).count ?? 0, normalized: (norm7dRes as { count?: number }).count ?? 0 },
      last30d: { raw: (raw30dRes as { count?: number }).count ?? 0, normalized: (norm30dRes as { count?: number }).count ?? 0 },
    },
    meta: { timestamp: new Date().toISOString() },
  });
}
