/**
 * Phase 3 — POST /api/admin/approval-requests/[id]/resolve.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getApprovalRequest, resolveApprovalRequest } from "@/modules/policy/repositories/approval-requests.repository";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: ar } = await getApprovalRequest(supabase, id);
  if (!ar) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ar.status !== "pending") return NextResponse.json({ error: "Already resolved" }, { status: 400 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id, role")
    .eq("user_id", userRes.user.id)
    .eq("org_id", ar.org_id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { action?: "approve" | "reject" };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const action = body.action ?? "approve";
  const status = action === "approve" ? "approved" : "rejected";

  const { data, error } = await resolveApprovalRequest(supabase, id, status, userRes.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ approvalRequest: data });
}
