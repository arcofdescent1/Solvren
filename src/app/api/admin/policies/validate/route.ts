/**
 * Phase 2 Gap 2 — POST /api/admin/policies/validate.
 */
import { NextRequest, NextResponse } from "next/server";
import { validatePolicyDraft } from "@/modules/policy/services/policy-validation.service";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";

export async function POST(req: NextRequest) {
  try {
    await requireAnyOrgPermission("policy.manage");

    let body: {
      displayName?: string;
      policyKey?: string;
      scope?: string;
      scopeRef?: string | null;
      defaultDisposition?: string;
      rules?: unknown[];
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const result = validatePolicyDraft({
      displayName: body.displayName,
      policyKey: body.policyKey,
      scope: body.scope,
      scopeRef: body.scopeRef,
      defaultDisposition: body.defaultDisposition,
      rules: body.rules as import("@/modules/policy/domain").PolicyRule[],
    });

    return NextResponse.json({
      valid: result.valid,
      errors: result.errors,
      warnings: result.warnings,
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
