/**
 * Phase 2 Gap 2 — POST /api/admin/policies/[policyId]/activate.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPolicyById, updatePolicy } from "@/modules/policy/repositories/policies.repository";
import { validatePolicyDraft } from "@/modules/policy/services/policy-validation.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ policyId: string }> }
) {
  const { policyId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: policy } = await getPolicyById(supabase, policyId);
  if (!policy) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const validation = validatePolicyDraft({
    displayName: policy.display_name,
    scope: policy.scope,
    scopeRef: policy.scope_ref,
    defaultDisposition: policy.default_disposition,
    rules: policy.rules_json as import("@/modules/policy/domain").PolicyRule[],
  });
  if (!validation.valid) {
    return NextResponse.json({ error: "Cannot activate: validation failed", errors: validation.errors }, { status: 400 });
  }

  const { data, error } = await updatePolicy(supabase, policyId, {
    status: "active",
    updated_by_user_id: userRes.user.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ policy: data });
}
