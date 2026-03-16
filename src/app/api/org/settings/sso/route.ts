/**
 * GET /api/org/settings/sso
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: providers } = await admin
    .from("sso_providers")
    .select("id, provider_type, protocol, display_name, enabled, enforce_sso, allow_local_fallback")
    .eq("org_id", orgId);

  const { data: mappings } = await admin
    .from("sso_role_mappings")
    .select("id, provider_id, mapping_type, source_key, source_value, target_role, priority")
    .eq("org_id", orgId);

  const enabled = (providers ?? []).some((p) => (p as { enabled?: boolean }).enabled);
  const enforceSso = (providers ?? []).some((p) => (p as { enforce_sso?: boolean }).enforce_sso);

  return NextResponse.json({
    enabled,
    enforceSso,
    providers: (providers ?? []).map((p) => ({
      id: (p as { id: string }).id,
      providerType: (p as { provider_type?: string }).provider_type,
      protocol: (p as { protocol?: string }).protocol,
      displayName: (p as { display_name?: string }).display_name,
      status: "connected",
      allowLocalFallback: (p as { allow_local_fallback?: boolean }).allow_local_fallback,
      enabled: (p as { enabled?: boolean }).enabled,
      enforceSso: (p as { enforce_sso?: boolean }).enforce_sso,
    })),
    roleMappings: (mappings ?? []).map((m) => ({
      id: (m as { id: string }).id,
      providerId: (m as { provider_id?: string }).provider_id,
      mappingType: (m as { mapping_type?: string }).mapping_type,
      sourceKey: (m as { source_key?: string }).source_key,
      sourceValue: (m as { source_value?: string }).source_value,
      targetRole: (m as { target_role?: string }).target_role,
      priority: (m as { priority?: number }).priority ?? 100,
    })),
  });
}
