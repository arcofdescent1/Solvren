/**
 * Phase 2 Gap 2 — POST /api/admin/policies/[policyId]/duplicate.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPolicyById, duplicatePolicy } from "@/modules/policy/repositories/policies.repository";

async function getOrgId(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return null;
  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (membership as { org_id: string } | null)?.org_id ?? null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ policyId: string }> }
) {
  const { policyId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getOrgId(supabase);
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  const { data: existing } = await getPolicyById(supabase, policyId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { policyKey?: string; displayName?: string };
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const policyKey = body.policyKey ?? `${existing.policy_key}_copy`;
  const displayName = body.displayName ?? `${existing.display_name} (copy)`;

  const { data, error } = await duplicatePolicy(supabase, policyId, {
    org_id: existing.org_id,
    policy_key: policyKey,
    display_name: displayName,
    created_by_user_id: userRes.user.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ policy: data });
}
