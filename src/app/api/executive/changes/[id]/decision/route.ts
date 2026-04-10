import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { authStateFromUser, requireVerifiedResponse } from "@/lib/auth";
import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { canViewChange } from "@/lib/access/changeAccess";
import { isExecutiveUserForPhase1 } from "@/lib/rbac/isExecutiveUserForPhase1";
import { persistExecutiveDecision } from "@/lib/executive/persistExecutiveDecision";
import { parseExecutiveDecisionBody } from "@/lib/executive/parseDecisionBody";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const forbidden = requireVerifiedResponse(authStateFromUser(userRes.user));
  if (forbidden) return forbidden;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseExecutiveDecisionBody(raw);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  }
  const { decision, comment } = parsed;

  const { data: change, error: ceErr } = await scopeActiveChangeEvents(
    supabase.from("change_events").select("id, org_id, domain, status, created_by, is_restricted")
  )
    .eq("id", id)
    .maybeSingle();

  if (ceErr || !change) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const canView = await canViewChange(supabase, userRes.user.id, change);
  if (!canView) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const exec = await isExecutiveUserForPhase1(
    supabase,
    userRes.user.id,
    change.org_id as string
  );
  if (!exec) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await persistExecutiveDecision(supabase, {
    orgId: change.org_id as string,
    changeId: id,
    userId: userRes.user.id,
    decision,
    comment,
  });

  if (!result.ok) {
    return NextResponse.json(result.body, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
