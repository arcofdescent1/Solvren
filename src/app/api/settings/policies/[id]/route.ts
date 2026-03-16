import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrg } from "@/lib/org/requireAdminOrg";
import { auditLog } from "@/lib/audit";

type PatchBody = {
  name?: string;
  description?: string;
  rule_type?: string;
  rule_config?: Record<string, unknown>;
  systems_affected?: string[];
  enforcement_mode?: "MONITOR" | "REQUIRE_APPROVAL" | "BLOCK";
  enabled?: boolean;
  priority?: number;
};

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminOrg();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.status === 401 ? "Unauthorized" : "Admin role required" }, { status: auth.status });
  }
  const { id } = await ctx.params;
  let body: PatchBody;
  try { body = (await req.json()) as PatchBody; } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const mode = body.enforcement_mode;
  if (mode && !["MONITOR", "REQUIRE_APPROVAL", "BLOCK"].includes(mode)) {
    return NextResponse.json({ error: "Invalid enforcement_mode" }, { status: 400 });
  }
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = String(body.name).trim();
  if (body.description !== undefined) updates.description = body.description;
  if (body.rule_type !== undefined) updates.rule_type = body.rule_type;
  if (body.rule_config !== undefined) updates.rule_config = body.rule_config;
  if (body.systems_affected !== undefined) updates.systems_affected = body.systems_affected;
  if (body.enforcement_mode !== undefined) updates.enforcement_mode = body.enforcement_mode;
  if (body.enabled !== undefined) updates.enabled = body.enabled;
  if (body.priority !== undefined) updates.priority = Number(body.priority);
  if (Object.keys(updates).length === 0) {
    const { data } = await createAdminClient().from("revenue_policies").select("*").eq("id", id).eq("org_id", auth.orgId).single();
    return NextResponse.json({ ok: true, policy: data });
  }
  const admin = createAdminClient();
  const { data, error } = await admin.from("revenue_policies").update(updates).eq("id", id).eq("org_id", auth.orgId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, policy: data });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminOrg();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.status === 401 ? "Unauthorized" : "Admin role required" }, { status: auth.status });
  }
  const { id } = await ctx.params;
  const admin = createAdminClient();
  const { error } = await admin.from("revenue_policies").delete().eq("id", id).eq("org_id", auth.orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await auditLog(auth.supabase, { orgId: auth.orgId, actorId: auth.user!.id, action: "revenue_policy_deleted", entityType: "revenue_policy", entityId: id, metadata: {} });
  return NextResponse.json({ ok: true });
}
