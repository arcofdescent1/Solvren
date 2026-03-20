/**
 * Gap 4 — POST /api/execution/actions/[id]/retry (§13.2).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { retryActionExecution } from "@/modules/integrations/actions/retryActionExecution";
import { getActionExecution } from "@/modules/integrations/reliability/repositories/integration-action-executions.repository";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { data: exec } = await getActionExecution(supabase, id);
  if (!exec) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .eq("org_id", exec.org_id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const result = await retryActionExecution(supabase, id);

  return NextResponse.json({
    success: result.success,
    executionId: result.executionId,
    externalId: result.externalId,
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
    status: result.status,
    attemptCount: result.attemptCount,
    nextRetryAt: result.nextRetryAt,
  });
}
