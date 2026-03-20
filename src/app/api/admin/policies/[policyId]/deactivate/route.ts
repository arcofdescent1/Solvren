/**
 * Phase 2 Gap 2 — POST /api/admin/policies/[policyId]/deactivate.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPolicyById, updatePolicy } from "@/modules/policy/repositories/policies.repository";

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

  const { data, error } = await updatePolicy(supabase, policyId, {
    status: "inactive",
    updated_by_user_id: userRes.user.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ policy: data });
}
