import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { auditLog } from "@/lib/audit";
import { env } from "@/lib/env";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    if (!env.netsuiteIntegrationEnabled) return NextResponse.json({ error: "NetSuite not configured" }, { status: 503 });
    const { templateId } = await params;

    let body: { organizationId?: string; name?: string; domain?: string; templateType?: string; queryText?: string; parameters?: Record<string, unknown>; thresholdConfig?: Record<string, unknown>; enabled?: boolean };
    try { body = (await req.json()) as typeof body; } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
    const orgId = body.organizationId ?? req.nextUrl.searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "organizationId required" }, { status: 400 });

    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.manage");
    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("netsuite_validation_templates")
      .select("id, org_id")
      .eq("id", templateId)
      .eq("org_id", ctx.orgId)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.domain !== undefined) updates.domain = body.domain;
    if (body.templateType !== undefined) updates.template_type = body.templateType;
    if (body.queryText !== undefined) updates.query_text = body.queryText;
    if (body.parameters !== undefined) updates.parameters = body.parameters;
    if (body.thresholdConfig !== undefined) updates.threshold_config = body.thresholdConfig;
    if (typeof body.enabled === "boolean") updates.enabled = body.enabled;

    if (Object.keys(updates).length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 });

    await admin.from("netsuite_validation_templates").update(updates).eq("id", templateId).eq("org_id", ctx.orgId);
    await auditLog(ctx.supabase, { orgId: ctx.orgId, actorId: ctx.user.id, actorType: "USER", action: "netsuite.validation_template.updated", entityType: "netsuite_template", entityId: templateId, metadata: {} });
    return NextResponse.json({ success: true });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
