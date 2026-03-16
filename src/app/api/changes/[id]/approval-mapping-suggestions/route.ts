import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveApprovalRoleSuggestions } from "@/services/approvals/roleMapping";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: changeId } = await ctx.params;
  const { data: change, error: chErr } = await supabase
    .from("change_events")
    .select("id, org_id, domain, change_type, structured_change_type, systems_involved")
    .eq("id", changeId)
    .maybeSingle();
  if (chErr) return NextResponse.json({ error: chErr.message }, { status: 500 });
  if (!change) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("org_id", change.org_id)
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const result = await resolveApprovalRoleSuggestions(admin, {
    orgId: String(change.org_id),
    domain: String(change.domain ?? "REVENUE"),
    systems: Array.isArray(change.systems_involved) ? (change.systems_involved as string[]) : [],
    changeType: String(change.structured_change_type ?? change.change_type ?? "") || null,
  });

  return NextResponse.json({
    ok: true,
    changeId,
    domain: String(change.domain ?? "REVENUE"),
    systems: Array.isArray(change.systems_involved) ? (change.systems_involved as string[]) : [],
    changeType: String(change.structured_change_type ?? change.change_type ?? "") || null,
    ...result,
  });
}
