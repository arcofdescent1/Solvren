/**
 * Phase 2 Gap 2 — POST /api/admin/policy-exceptions/[exceptionId]/deactivate.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { updatePolicyException } from "@/modules/policy/repositories/policy-exceptions.repository";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ exceptionId: string }> }
) {
  const { exceptionId } = await params;
  const supabaseClient = await createServerSupabaseClient();
  const { data: userRes } = await supabaseClient.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: ex } = await supabaseClient
    .from("policy_exceptions")
    .select("id, org_id")
    .eq("id", exceptionId)
    .maybeSingle();

  if (!ex) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: membership } = await supabaseClient
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .eq("org_id", (ex as { org_id: string }).org_id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await updatePolicyException(supabaseClient, exceptionId, { status: "inactive" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ exception: data });
}
