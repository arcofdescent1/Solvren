/**
 * Phase 3 — GET/PATCH /api/admin/policies/[policyId].
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPolicyById, updatePolicy } from "@/modules/policy/repositories/policies.repository";

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

export async function PATCH(
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

  const updates: Parameters<typeof updatePolicy>[2] = {};
  if (body.displayName != null) updates.display_name = body.displayName as string;
  if (body.description != null) updates.description = body.description as string;
  if (body.scope != null) updates.scope = body.scope as string;
  if (body.scopeRef != null) updates.scope_ref = body.scopeRef as string | null;
  if (body.priorityOrder != null) updates.priority_order = body.priorityOrder as number;
  if (body.status != null) updates.status = body.status as string;
  if (body.defaultDisposition != null) updates.default_disposition = body.defaultDisposition as string;
  if (body.rules != null) updates.rules_json = body.rules as unknown[];

  const { data, error } = await updatePolicy(supabase, policyId, updates);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ policy: data });
}
