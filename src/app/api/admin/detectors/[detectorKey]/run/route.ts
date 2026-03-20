/**
 * Phase 4 — POST /api/admin/detectors/:detectorKey/run (§17.2).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDetectorDefinitionByKey } from "@/modules/detection/persistence/detector-definitions.repository";
import { listNormalizedSignals } from "@/modules/signals/persistence/normalized-signals.repository";
import { runDetector } from "@/modules/detection/engine/detector-runner.service";

async function getOrgIdAndAdminCheck(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return { orgId: null, ok: false };
  const { data: m } = await supabase
    .from("organization_members")
    .select("org_id, role")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const orgId = (m as { org_id: string } | null)?.org_id ?? null;
  const role = (m as { role: string } | null)?.role ?? "";
  const isAdmin = role === "owner" || role === "admin";
  return { orgId, ok: !!orgId && isAdmin };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ detectorKey: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { orgId, ok } = await getOrgIdAndAdminCheck(supabase);
  if (!ok || !orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { detectorKey } = await params;
  const { data: def } = await getDetectorDefinitionByKey(supabase, detectorKey);
  if (!def) return NextResponse.json({ error: "Detector not found" }, { status: 404 });

  let body: { windowHours?: number } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }
  const windowHours = body.windowHours ?? 168;
  const windowEnd = new Date();
  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const requiredSignals = (def.required_signal_keys_json ?? []) as string[];
  const signalKey = requiredSignals[0] ?? "payment_failed";
  const { data: signals } = await listNormalizedSignals(supabase, {
    orgId,
    signalKey,
    fromTime: windowStart.toISOString(),
    toTime: windowEnd.toISOString(),
    limit: 100,
  });

  const admin = createAdminClient();
  const result = await runDetector(admin, {
    orgId,
    detectorKey,
    signals,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
  });

  return NextResponse.json(result);
}
