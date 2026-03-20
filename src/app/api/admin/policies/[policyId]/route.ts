/**
 * Phase 3 — GET/PUT /api/admin/policies/[policyId].
 * Phase 2 Gap 2 — PUT with validation, versioning.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPolicyById, updatePolicy } from "@/modules/policy/repositories/policies.repository";
import { validatePolicyDraft } from "@/modules/policy/services/policy-validation.service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ policyId: string }> }
) {
  const { policyId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await getPolicyById(supabase, policyId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  if (!membership?.org_id && data.org_id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (data.org_id && (membership as { org_id: string }).org_id !== data.org_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ policy: data });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ policyId: string }> }
) {
  const { policyId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: existing } = await getPolicyById(supabase, policyId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  if (existing.org_id && (membership as { org_id?: string })?.org_id !== existing.org_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Parameters<typeof updatePolicy>[2] = {
    updated_by_user_id: userRes.user.id,
  };
  if (body.displayName != null) updates.display_name = body.displayName as string;
  if (body.description != null) updates.description = body.description as string;
  if (body.scope != null) updates.scope = body.scope as string;
  if (body.scopeRef != null) updates.scope_ref = body.scopeRef as string | null;
  if (body.priorityOrder != null) updates.priority_order = body.priorityOrder as number;
  if (body.defaultDisposition != null) updates.default_disposition = body.defaultDisposition as string;
  if (body.rules != null) updates.rules_json = body.rules as unknown[];

  if (body.status != null && body.status === "active") {
    const validation = validatePolicyDraft({
      displayName: (body.displayName ?? existing.display_name) as string,
      scope: (body.scope ?? existing.scope) as string,
      scopeRef: (body.scopeRef ?? existing.scope_ref) as string | null,
      defaultDisposition: (body.defaultDisposition ?? existing.default_disposition) as string,
      rules: (body.rules ?? existing.rules_json) as import("@/modules/policy/domain").PolicyRule[],
    });
    if (!validation.valid) {
      return NextResponse.json({ error: "Validation failed", errors: validation.errors }, { status: 400 });
    }
  }
  if (body.status != null) updates.status = body.status as string;

  const { data, error } = await updatePolicy(supabase, policyId, updates);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ policy: data });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ policyId: string }> }) {
  return PUT(req, ctx);
}
