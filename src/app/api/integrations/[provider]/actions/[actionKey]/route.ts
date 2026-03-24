/**
 * Phase 1 — POST /api/integrations/:provider/actions/:actionKey (§15.1).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { executeAction } from "@/modules/integrations/actions/actionExecutionService";
import { preExecutionCheck } from "@/modules/policy/enforcement/preExecutionCheck";
import { resolveGovernanceTraceFromApprovedPolicyRequest } from "@/modules/policy/repositories/approval-requests.repository";
import { getAccountByOrgAndProvider, getAccountById } from "@/modules/integrations/core/integrationAccountsRepo";
import { hasProvider } from "@/modules/integrations/registry/providerRegistry";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string; actionKey: string }> }
) {
  try {
    const { provider, actionKey } = await params;
    if (!hasProvider(provider)) {
      return NextResponse.json({ ok: false, error: { code: "not_found", message: "Unknown provider" } }, { status: 404 });
    }

    let body: {
      orgId?: string;
      integrationAccountId?: string;
      issueId?: string;
      policyApprovalRequestId?: string;
      [k: string]: unknown;
    };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      body = {};
    }
    const policyApprovalRequestId =
      typeof body.policyApprovalRequestId === "string" && body.policyApprovalRequestId.trim()
        ? body.policyApprovalRequestId.trim()
        : null;
    const orgIdRaw = body.orgId ?? req.nextUrl.searchParams.get("orgId");
    let integrationAccountId = body.integrationAccountId;

    let ctx: Awaited<ReturnType<typeof requireOrgPermission>>;
    if (integrationAccountId) {
      const supabase = await createServerSupabaseClient();
      const { data: account } = await getAccountById(supabase, integrationAccountId);
      if (!account) {
        return NextResponse.json({ ok: false, error: { code: "not_found", message: "Account not found" } }, { status: 404 });
      }
      ctx = await requireOrgPermission(parseRequestedOrgId(account.org_id), "integrations.manage");
    } else if (orgIdRaw) {
      ctx = await requireOrgPermission(parseRequestedOrgId(orgIdRaw), "integrations.manage");
      const { data: account } = await getAccountByOrgAndProvider(ctx.supabase, ctx.orgId, provider);
      integrationAccountId = account?.id;
    } else {
      return NextResponse.json({ ok: false, error: { code: "bad_request", message: "orgId and integration account required" } }, { status: 400 });
    }

    if (!integrationAccountId) {
      return NextResponse.json({ ok: false, error: { code: "bad_request", message: "orgId and integration account required" } }, { status: 400 });
    }

    const { data: account } = await getAccountById(ctx.supabase, integrationAccountId);
    if (!account || account.org_id !== ctx.orgId) {
      return NextResponse.json({ ok: false, error: { code: "not_found", message: "Account not found" } }, { status: 404 });
    }

    const { ...actionParams } = body;
    delete actionParams.orgId;
    delete actionParams.integrationAccountId;
    delete actionParams.issueId;
    delete actionParams.policyApprovalRequestId;

    const fullActionKey = `${provider}.${actionKey}`;

    let governanceTraceId: string | null = null;

    if (policyApprovalRequestId) {
      if (!body.issueId) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "bad_request",
              message: "issueId is required when policyApprovalRequestId is set (stable governance trace binding)",
            },
          },
          { status: 400 }
        );
      }
      const traceRes = await resolveGovernanceTraceFromApprovedPolicyRequest(ctx.supabase, {
        approvalRequestId: policyApprovalRequestId,
        orgId: ctx.orgId,
        issueId: body.issueId,
        actionKeyForPolicy: fullActionKey,
      });
      if ("error" in traceRes) {
        return NextResponse.json(
          { ok: false, error: { code: "policy_approval_invalid", message: traceRes.error } },
          { status: 400 }
        );
      }
      governanceTraceId = traceRes.governanceTraceId;
    } else {
      const policyCheck = await preExecutionCheck(ctx.supabase, {
        orgId: ctx.orgId,
        actionKey: fullActionKey,
        issueId: body.issueId ?? undefined,
        actorUserId: ctx.user.id,
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
          {
            ok: false,
            error: {
              code: "approval_required",
              message: "Approval required",
              approvalRequestId: policyCheck.approvalRequestId,
              retryHint:
                "After approving in Policy Center, retry with the same payload plus policyApprovalRequestId and issueId to link execution to the original governance decision.",
            },
          },
          { status: 202 }
        );
      }
      governanceTraceId = "allowed" in policyCheck && policyCheck.allowed ? policyCheck.governanceTraceId : null;
    }

    const result = await executeAction(ctx.supabase, {
      orgId: ctx.orgId,
      integrationAccountId,
      actionKey,
      params: actionParams,
      issueId: body.issueId ?? null,
      userId: ctx.user.id,
      policyAlreadyEnforced: true,
      governanceTraceId,
    });

    return NextResponse.json({
    ok: result.success,
    data: { success: result.success, externalId: result.externalId, message: result.message },
    error: result.success ? undefined : { code: result.errorCode ?? "action_failed", message: result.errorMessage },
    meta: { timestamp: new Date().toISOString() },
  });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
