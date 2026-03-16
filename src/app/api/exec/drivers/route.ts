import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: orgRow, error: orgErr } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (orgErr) return NextResponse.json({ error: orgErr.message }, { status: 500 });
  const orgId = orgRow?.org_id as string | undefined;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 400 });

  const sp = new URL(req.url).searchParams;
  const days = Number(sp.get("days") ?? "30");
  const limit = Number(sp.get("limit") ?? "10");

  const { data, error } = await supabase.rpc("exec_revenue_top_drivers", {
    p_org_id: orgId,
    p_days: Number.isFinite(days) ? days : 30,
    p_limit: Number.isFinite(limit) ? limit : 10,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ...data });
}
