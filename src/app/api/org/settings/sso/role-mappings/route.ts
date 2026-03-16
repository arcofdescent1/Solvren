/**
 * GET /api/org/settings/sso/role-mappings?organizationId=&providerId=
 * PUT /api/org/settings/sso/role-mappings
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { auditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { searchParams } = new URL(req.url);
  const organizationId = searchParams.get("organizationId");
  const providerId = searchParams.get("providerId");
  if (!organizationId || !providerId) {
    return NextResponse.json({ error: "organizationId and providerId required" }, { status: 400 });
  }

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", organizationId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member || !isAdminLikeRole(parseOrgRole((member as { role?: string }).role ?? null))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("sso_role_mappings")
    .select("id, mapping_type, source_key, source_value, target_role, priority")
    .eq("org_id", organizationId)
    .eq("provider_id", providerId)
    .order("priority", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const mappings = (rows ?? []).map((r) => ({
    id: (r as { id: string }).id,
    mappingType: (r as { mapping_type: string }).mapping_type,
    sourceKey: (r as { source_key: string | null }).source_key ?? null,
    sourceValue: (r as { source_value: string | null }).source_value ?? null,
    targetRole: (r as { target_role: string }).target_role,
    priority: (r as { priority: number }).priority,
  }));
  return NextResponse.json({ mappings });
}

export async function PUT(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    organizationId: string;
    providerId: string;
    mappings: Array<{
      id?: string;
      mappingType: string;
      sourceKey?: string | null;
      sourceValue?: string | null;
      targetRole: string;
      priority?: number;
    }>;
  };
  const { organizationId, providerId, mappings } = body;
  if (!organizationId || !providerId || !Array.isArray(mappings)) {
    return NextResponse.json({ error: "organizationId, providerId, mappings required" }, { status: 400 });
  }

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", organizationId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member || !isAdminLikeRole(parseOrgRole((member as { role?: string }).role ?? null))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await admin
    .from("sso_role_mappings")
    .delete()
    .eq("org_id", organizationId)
    .eq("provider_id", providerId);

  if (mappings.length > 0) {
    const rows = mappings.map((m) => ({
      org_id: organizationId,
      provider_id: providerId,
      mapping_type: m.mappingType,
      source_key: m.sourceKey ?? null,
      source_value: m.sourceValue ?? null,
      target_role: m.targetRole,
      priority: m.priority ?? 100,
    }));
    const { error } = await admin.from("sso_role_mappings").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await auditLog(admin as Parameters<typeof auditLog>[0], {
      orgId: organizationId,
      actorId: userRes.user.id,
      actorType: "USER",
      action: "sso.role_mappings.updated",
      entityType: "sso_provider",
      entityId: providerId,
      metadata: { count: mappings.length },
    });
  } catch {
    // non-fatal
  }

  return NextResponse.json({ status: "ok" });
}
