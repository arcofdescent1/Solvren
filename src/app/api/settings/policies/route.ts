import { NextResponse } from "next/server";
import { auditLog } from "@/lib/audit";
import { authzErrorResponse, requireOrgPermission, resolveDefaultOrgForUser } from "@/lib/server/authz";
import { revenuePolicyCreateSchema } from "@/lib/server/apiSchemas";

async function policyContext() {
  const def = await resolveDefaultOrgForUser();
  return requireOrgPermission(def.orgId, "policy.manage");
}

export async function GET() {
  try {
    const ctx = await policyContext();
    const { data, error } = await ctx.supabase
      .from("revenue_policies")
      .select("*")
      .eq("org_id", ctx.orgId)
      .order("priority", { ascending: false })
      .order("name", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, policies: data ?? [] });
  } catch (e) {
    return authzErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await policyContext();
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = revenuePolicyCreateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
    }
    const body = parsed.data;
    const { data, error } = await ctx.supabase
      .from("revenue_policies")
      .insert({
        org_id: ctx.orgId,
        name: body.name,
        description: body.description ?? null,
        rule_type: body.rule_type,
        rule_config: body.rule_config ?? {},
        systems_affected: body.systems_affected ?? [],
        enforcement_mode: body.enforcement_mode,
        enabled: body.enabled ?? true,
        priority: body.priority ?? 100,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await auditLog(ctx.supabase, {
      orgId: ctx.orgId,
      actorId: ctx.user.id,
      action: "org.settings.updated",
      entityType: "revenue_policy",
      entityId: data.id,
      metadata: { name: body.name, rule_type: body.rule_type, enforcement_mode: body.enforcement_mode },
    });
    return NextResponse.json({ ok: true, policy: data });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
