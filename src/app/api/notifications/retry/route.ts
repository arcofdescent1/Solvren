import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const maxDuration = 15;
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

type Body = { outboxId: string };

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.outboxId)
    return NextResponse.json(
      { error: "Missing outboxId" },
      { status: 400 }
    );

  const { data: row, error: rErr } = await supabase
    .from("notification_outbox")
    .select("id, org_id, status")
    .eq("id", body.outboxId)
    .single();

  if (rErr || !row)
    return NextResponse.json(
      { error: rErr?.message ?? "Not found" },
      { status: 404 }
    );

  if (row.status !== "FAILED")
    return NextResponse.json(
      { error: "Only FAILED notifications can be retried." },
      { status: 400 }
    );

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", row.org_id)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member || !isAdminLikeRole(parseOrgRole(member.role ?? null)))
    return NextResponse.json({ error: "Owner/Admin required" }, { status: 403 });

  const { error: updErr } = await supabase
    .from("notification_outbox")
    .update({
      status: "PENDING",
      attempt_count: 0,
      last_error: null,
      available_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  if (updErr)
    return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
