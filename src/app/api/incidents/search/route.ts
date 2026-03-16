import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId");
  const q = (url.searchParams.get("q") ?? "").trim();

  if (!orgId) return NextResponse.json({ error: "Missing orgId" }, { status: 400 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let query = supabase
    .from("incidents")
    .select("id, severity, revenue_impact, detected_at, resolved_at, description, change_event_id")
    .eq("org_id", orgId)
    .is("resolved_at", null)
    .order("detected_at", { ascending: false })
    .limit(25);

  if (q) {
    query = query.ilike("description", `%${q}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sorted = (data ?? []).sort((a, b) => {
    const au = a.change_event_id ? 1 : 0;
    const bu = b.change_event_id ? 1 : 0;
    return au - bu;
  });

  return NextResponse.json({ ok: true, incidents: sorted });
}
