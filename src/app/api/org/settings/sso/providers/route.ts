/**
 * POST /api/org/settings/sso/providers - Create new SSO provider
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { organizationId: string; providerType: string; protocol: string; displayName?: string };
  const { organizationId, providerType, protocol, displayName } = body;
  if (!organizationId || !providerType || !protocol) {
    return NextResponse.json({ error: "organizationId, providerType, protocol required" }, { status: 400 });
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

  const { data: row, error } = await admin
    .from("sso_providers")
    .insert({
      org_id: organizationId,
      provider_type: providerType,
      protocol,
      display_name: displayName ?? providerType,
      enabled: false,
      enforce_sso: false,
      allow_local_fallback: true,
      allow_jit_provisioning: true,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: (row as { id: string }).id });
}
