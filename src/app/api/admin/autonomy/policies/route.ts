/**
 * Phase 8 — GET/POST /api/admin/autonomy/policies.
 */
import { NextRequest, NextResponse } from "next/server";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAnyOrgPermission("admin.simulations.manage");

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope") ?? undefined;

    const { listActivePolicies } = await import("@/modules/autonomy/persistence/policies.repository");
    const { data: policies, error } = await listActivePolicies(ctx.supabase, ctx.orgId, scope);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ policies: policies ?? [] });
  } catch (e) {
    return authzErrorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAnyOrgPermission("admin.simulations.manage");

    let body: {
      policy_key: string;
      display_name: string;
      description: string;
      policy_scope: string;
      autonomy_mode: string;
      policy_rules_json: Record<string, unknown>;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { data, error } = await ctx.supabase
      .from("policies")
      .insert({
        org_id: ctx.orgId,
        policy_key: body.policy_key,
        display_name: body.display_name,
        description: body.description,
        policy_scope: body.policy_scope,
        autonomy_mode: body.autonomy_mode,
        policy_rules_json: body.policy_rules_json ?? {},
        created_by_user_id: ctx.user.id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ policy: data });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
