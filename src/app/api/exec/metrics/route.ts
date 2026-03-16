import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fetchExecMetrics } from "@/services/revenue/execMetrics";

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

  const days = Number(new URL(req.url).searchParams.get("days") ?? "30");
  const metrics = await fetchExecMetrics(supabase, {
    orgId,
    days: Number.isFinite(days) ? days : 30,
  });

  return NextResponse.json({ ok: true, metrics });
}
