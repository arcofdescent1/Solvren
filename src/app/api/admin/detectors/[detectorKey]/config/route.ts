/**
 * Phase 4 — GET/PUT /api/admin/detectors/:detectorKey/config (§17.1).
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDetectorDefinitionByKey } from "@/modules/detection/persistence/detector-definitions.repository";
import { getDetectorConfig, upsertDetectorConfig } from "@/modules/detection/persistence/detector-configs.repository";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ detectorKey: string }> }
) {
  try {
    const ctx = await requireAnyOrgPermission("admin.jobs.view");

    const { detectorKey } = await params;
    const { data: def } = await getDetectorDefinitionByKey(ctx.supabase, detectorKey);
    if (!def) return NextResponse.json({ error: "Detector not found" }, { status: 404 });

    const { data: config } = await getDetectorConfig(ctx.supabase, ctx.orgId, def.id);
    return NextResponse.json({
      enabled: config?.enabled ?? false,
      thresholdOverrides: config?.threshold_overrides_json ?? {},
      rolloutState: config?.rollout_state ?? "off",
      severityOverride: config?.severity_override ?? null,
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ detectorKey: string }> }
) {
  try {
    const ctx = await requireAnyOrgPermission("admin.jobs.view");

    const { detectorKey } = await params;
    const { data: def } = await getDetectorDefinitionByKey(ctx.supabase, detectorKey);
    if (!def) return NextResponse.json({ error: "Detector not found" }, { status: 404 });

    let body: { enabled?: boolean; thresholdOverrides?: Record<string, unknown>; rolloutState?: string };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: config } = await getDetectorConfig(admin, ctx.orgId, def.id);
    const { data: updated, error } = await upsertDetectorConfig(admin, {
      org_id: ctx.orgId,
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
  } catch (e) {
    return authzErrorResponse(e);
  }
}
