/**
 * POST /api/org/settings/sso/providers/[providerId]/test
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { auditLog } from "@/lib/audit";
import { fetchOidcDiscovery } from "@/services/sso/oidc";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ providerId: string }> }
) {
  const { providerId } = await params;
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

  if (!member || !isAdminLikeRole(parseOrgRole((member as { role?: string }).role ?? null))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: provider } = await admin
    .from("sso_providers")
    .select("id, protocol, issuer")
    .eq("id", providerId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 });

  const p = provider as { protocol?: string; issuer?: string };
  const checks: Array<{ name: string; status: string }> = [];

  if (p.protocol === "oidc" && p.issuer) {
    try {
      const discovery = await fetchOidcDiscovery(p.issuer);
      checks.push({ name: "issuer_reachable", status: "ok" });
      if (discovery.jwksUri) checks.push({ name: "jwks_available", status: "ok" });
      if (discovery.tokenEndpoint) checks.push({ name: "token_endpoint", status: "ok" });
    } catch {
      checks.push({ name: "issuer_reachable", status: "error" });
    }
  } else if (p.protocol === "oidc") {
    checks.push({ name: "issuer_configured", status: "error" });
  }

  if (p.protocol === "saml") {
    checks.push({ name: "saml_config", status: "manual_validation" });
  }

  const status = checks.every((c) => c.status === "ok") ? "ok" : "warning";
  try {
    await auditLog(admin as Parameters<typeof auditLog>[0], {
      orgId,
      actorId: userRes.user?.id ?? null,
      actorType: "USER",
      action: "sso.provider.test",
      entityType: "sso_provider",
      entityId: providerId,
      metadata: { status, checks },
    });
  } catch {
    // non-fatal
  }

  return NextResponse.json({ status, checks });
}
