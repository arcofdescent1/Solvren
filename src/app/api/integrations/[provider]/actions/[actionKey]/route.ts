/**
 * Phase 1 — POST /api/integrations/:provider/actions/:actionKey (§15.1).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { executeAction } from "@/modules/integrations/actions/actionExecutionService";
import { preExecutionCheck } from "@/modules/policy/enforcement/preExecutionCheck";
import { getAccountByOrgAndProvider, getAccountById } from "@/modules/integrations/core/integrationAccountsRepo";
import { hasProvider } from "@/modules/integrations/registry/providerRegistry";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string; actionKey: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "Unauthorized" } }, { status: 401 });
  }

  const { provider, actionKey } = await params;
  if (!hasProvider(provider)) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Unknown provider" } }, { status: 404 });
  }

  let body: { orgId?: string; integrationAccountId?: string; issueId?: string; [k: string]: unknown };
  try {
    body = (await req.json()) as { orgId?: string; integrationAccountId?: string; issueId?: string };
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
  if (!account || account.org_id !== orgId) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Account not found" } }, { status: 404 });
  }

  const { ...actionParams } = body;
  delete actionParams.orgId;
  delete actionParams.integrationAccountId;
  delete actionParams.issueId;

  const fullActionKey = `${provider}.${actionKey}`;
  const policyCheck = await preExecutionCheck(supabase, {
    orgId,
    actionKey: fullActionKey,
    issueId: body.issueId ?? undefined,
    actorUserId: userRes.user.id,
    provider,
  });
  if ("blocked" in policyCheck && policyCheck.blocked) {
    return NextResponse.json(
      { ok: false, error: { code: "policy_blocked", message: policyCheck.reason } },
      { status: 403 }
    );
  }
  if ("requiresApproval" in policyCheck && policyCheck.requiresApproval) {
    return NextResponse.json(
      { ok: false, error: { code: "approval_required", message: "Approval required", approvalRequestId: policyCheck.approvalRequestId } },
      { status: 202 }
    );
  }

  const result = await executeAction(supabase, {
    orgId,
    integrationAccountId,
    actionKey,
    params: actionParams,
    issueId: body.issueId ?? null,
    userId: userRes.user.id,
  });

  return NextResponse.json({
    ok: result.success,
    data: { success: result.success, externalId: result.externalId, message: result.message },
    error: result.success ? undefined : { code: result.errorCode ?? "action_failed", message: result.errorMessage },
    meta: { timestamp: new Date().toISOString() },
  });
}
