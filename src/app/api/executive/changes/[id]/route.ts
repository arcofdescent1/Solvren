import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { authStateFromUser, requireVerifiedResponse } from "@/lib/auth";
import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { canViewChange } from "@/lib/access/changeAccess";
import { isExecutiveUserForPhase1 } from "@/lib/rbac/isExecutiveUserForPhase1";
import { buildExecutiveChangeView } from "@/lib/executive/buildExecutiveChangeView";

export async function GET(
  _req: Request,
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

  const fullView = await buildExecutiveChangeView(supabase, id);
  if (!fullView) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(fullView);
}
