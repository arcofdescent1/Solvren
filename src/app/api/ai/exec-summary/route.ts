import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOpenAI } from "@/lib/openai";
import { runExecutiveSummaryLLM } from "@/services/ai/runExecutiveSummaryLLM";

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

  const days = Number(new URL(req.url).searchParams.get("days") ?? "7");

  const { data: metrics, error: mErr } = await supabase.rpc("exec_revenue_metrics", {
    p_org_id: orgId,
    p_days: Number.isFinite(days) ? days : 7,
  });
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  const { data: driversRes, error: dErr } = await supabase.rpc("exec_revenue_top_drivers", {
    p_org_id: orgId,
    p_days: Number.isFinite(days) ? days : 7,
    p_limit: 10,
  });
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });

  const driversData = driversRes as { drivers?: Record<string, unknown>[] } | null;
  const payload = {
    window_days: days,
    metrics: (metrics ?? {}) as Record<string, unknown>,
    top_drivers: (driversData?.drivers ?? []) as Record<string, unknown>[],
  };

  const openai = getOpenAI();
  if (!openai) {
    return NextResponse.json(
      { error: "AI integration disabled: OPENAI_API_KEY not configured" },
      { status: 503 }
    );
  }

  try {
    const summary = await runExecutiveSummaryLLM(payload);
    return NextResponse.json({
      ok: true,
      window_days: days,
      summary,
      payload,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI summary failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
