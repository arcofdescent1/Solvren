/**
 * Phase 1 — GET /api/integrations/:provider/status (§15.1).
 * Returns account status for the current org's installation of this provider.
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAccountByOrgAndProvider } from "@/modules/integrations/core/integrationAccountsRepo";
import { hasProvider } from "@/modules/integrations/registry/providerRegistry";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "Unauthorized" } }, { status: 401 });
  }

  const { provider } = await params;
  if (!hasProvider(provider)) {
    return NextResponse.json(
      { ok: false, error: { code: "not_found", message: "Unknown provider" } },
      { status: 404 }
    );
  }

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id);
  const orgIds = (memberships ?? []).map((m) => m.org_id);
  if (orgIds.length === 0) {
    return NextResponse.json({
      ok: true,
      data: { provider, status: "not_installed", environment: "production", objectCoverage: [], scopeCoverage: {} },
      meta: { timestamp: new Date().toISOString() },
    });
  }

  const orgId = orgIds[0];
  const { data: account, error } = await getAccountByOrgAndProvider(supabase, orgId, provider);
  if (error) {
    return NextResponse.json({ ok: false, error: { code: "server_error", message: error.message } }, { status: 500 });
  }

  const health = (account?.health_summary_json ?? {}) as Record<string, string>;
  const scopeCoverage = {
    requiredGranted: (account?.scopes_granted_json ?? []).length,
    requiredMissing: (account?.scopes_missing_json ?? []).length,
    optionalGranted: 0,
    optionalMissing: 0,
  };

  return NextResponse.json({
    ok: true,
    data: {
      provider,
      status: account?.status ?? "not_installed",
      environment: "production",
      installedAt: account?.installed_at ?? null,
      lastSuccessAt: account?.last_success_at ?? null,
      lastErrorAt: account?.last_error_at ?? null,
      health,
      scopeCoverage,
      objectCoverage: [],
    },
    meta: { timestamp: new Date().toISOString() },
  });
}
