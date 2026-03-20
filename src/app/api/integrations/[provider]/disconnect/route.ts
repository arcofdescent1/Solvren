/**
 * Phase 1 — POST /api/integrations/:provider/disconnect (§15.1).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { disconnectIntegration } from "@/modules/integrations/auth/connectionManager";
import { getAccountByOrgAndProvider, getAccountById } from "@/modules/integrations/core/integrationAccountsRepo";
import { hasProvider } from "@/modules/integrations/registry/providerRegistry";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "Unauthorized" } }, { status: 401 });
  }

  const { provider } = await params;
  if (!hasProvider(provider)) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Unknown provider" } }, { status: 404 });
  }

  let body: { orgId?: string; integrationAccountId?: string };
  try {
    body = (await req.json()) as { orgId?: string; integrationAccountId?: string };
  } catch {
    body = {};
  }
  const orgId = body.orgId ?? req.nextUrl.searchParams.get("orgId");
  let integrationAccountId = body.integrationAccountId;
  if (!integrationAccountId && orgId) {
    const { data: account } = await getAccountByOrgAndProvider(supabase, orgId, provider);
    integrationAccountId = account?.id;
  }
  if (!orgId || !integrationAccountId) {
    return NextResponse.json({ ok: false, error: { code: "bad_request", message: "orgId and integration account required" } }, { status: 400 });
  }

  const { data: account } = await getAccountById(supabase, integrationAccountId);
  if (!account) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Account not found" } }, { status: 404 });
  }
  if (account.org_id !== orgId) {
    return NextResponse.json({ ok: false, error: { code: "forbidden", message: "Forbidden" } }, { status: 403 });
  }
  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  const role = (member as { role?: string } | null)?.role ?? "";
  if (!["owner", "admin"].includes(role)) {
    return NextResponse.json({ ok: false, error: { code: "forbidden", message: "Admin or owner required" } }, { status: 403 });
  }

  const result = await disconnectIntegration(supabase, {
    orgId,
    integrationAccountId,
    userId: userRes.user.id,
  });
  if (result.error) {
    return NextResponse.json({ ok: false, error: { code: "disconnect_failed", message: result.error } }, { status: 500 });
  }
  return NextResponse.json({ ok: true, data: { disconnected: true }, meta: { timestamp: new Date().toISOString() } });
}
