/**
 * Phase 4 — GET/PUT /api/admin/detectors/:detectorKey/config (§17.1).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDetectorDefinitionByKey } from "@/modules/detection/persistence/detector-definitions.repository";
import { getDetectorConfig, upsertDetectorConfig } from "@/modules/detection/persistence/detector-configs.repository";

async function getOrgId(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return null;
  const { data: m } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (m as { org_id: string } | null)?.org_id ?? null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ detectorKey: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const orgId = await getOrgId(supabase);
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { detectorKey } = await params;
  const { data: def } = await getDetectorDefinitionByKey(supabase, detectorKey);
  if (!def) return NextResponse.json({ error: "Detector not found" }, { status: 404 });

  const { data: config } = await getDetectorConfig(supabase, orgId, def.id);
  return NextResponse.json({
    enabled: config?.enabled ?? false,
    thresholdOverrides: config?.threshold_overrides_json ?? {},
    rolloutState: config?.rollout_state ?? "off",
    severityOverride: config?.severity_override ?? null,
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ detectorKey: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const orgId = await getOrgId(supabase);
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { detectorKey } = await params;
  const { data: def } = await getDetectorDefinitionByKey(supabase, detectorKey);
  if (!def) return NextResponse.json({ error: "Detector not found" }, { status: 404 });

  let body: { enabled?: boolean; thresholdOverrides?: Record<string, unknown>; rolloutState?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: config } = await getDetectorConfig(admin, orgId, def.id);
  const { data: updated, error } = await upsertDetectorConfig(admin, {
    org_id: orgId,
    detector_definition_id: def.id,
    enabled: body.enabled ?? config?.enabled ?? false,
    threshold_overrides_json: body.thresholdOverrides ?? config?.threshold_overrides_json ?? {},
    noise_control_overrides_json: config?.noise_control_overrides_json ?? {},
    routing_overrides_json: config?.routing_overrides_json ?? {},
    severity_override: config?.severity_override ?? null,
    priority_override: config?.priority_override ?? null,
    schedule_override_json: config?.schedule_override_json ?? null,
    rollout_state: (body.rolloutState as "off" | "observe_only" | "full") ?? config?.rollout_state ?? "off",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, config: updated });
}
