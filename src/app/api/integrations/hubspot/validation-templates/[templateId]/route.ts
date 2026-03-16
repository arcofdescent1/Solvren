import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { auditLog } from "@/lib/audit";
import { env } from "@/lib/env";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ templateId: string }> }) {
  if (!env.hubspotIntegrationEnabled) return NextResponse.json({ error: "HubSpot not configured" }, { status: 503 });
  const { templateId } = await params;
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { organizationId?: string; name?: string; domain?: string; templateType?: string; queryText?: string; parameters?: Record<string, unknown>; thresholdConfig?: Record<string, unknown>; enabled?: boolean };
  try { body = (await req.json()) as typeof body; } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const orgId = body.organizationId ?? req.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "organizationId required" }, { status: 400 });
  const { data: member } = await supabase.from("organization_members").select("role").eq("org_id", orgId).eq("user_id", userRes.user.id).maybeSingle();
  if (!member || !isAdminLikeRole(parseOrgRole((member as { role?: string }).role ?? null))) return NextResponse.json({ error: "Admin required" }, { status: 403 });
  const { data: existing } = await admin.from("hubspot_validation_templates").select("id").eq("id", templateId).eq("org_id", orgId).maybeSingle();
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
  await admin.from("hubspot_validation_templates").update(updates).eq("id", templateId).eq("org_id", orgId);
  await auditLog(supabase, { orgId, actorId: userRes.user.id, actorType: "USER", action: "hubspot.validation_template.updated", entityType: "hubspot_template", entityId: templateId, metadata: {} });
  return NextResponse.json({ success: true });
}
