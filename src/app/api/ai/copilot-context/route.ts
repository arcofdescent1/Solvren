/**
 * AI Revenue Risk Copilot - contextual summary, recommended actions, alerts.
 * Falls back to rule-based output when AI is disabled.
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOpenAI } from "@/lib/openai";
import { logAiRequest, checkAiDailyLimit } from "@/lib/ai/log-request";

type Body = {
  page?: string;
  dashboard_state?: { total_exposure?: number; high_risk_count?: number; unapproved_count?: number; compliance_pct?: number };
  risk_events?: Array<{ id: string; provider: string; object: string; risk_type: string; impact_amount: number | null; risk_bucket?: string; approved_at: string | null; change_event_id: string | null }>;
  change_requests?: Array<{ id: string; title: string; status: string }>;
};

function ruleFallback(body: Body) {
  const s = body.dashboard_state ?? {};
  const risks = body.risk_events ?? [];
  const high = s.high_risk_count ?? 0;
  const unapproved = s.unapproved_count ?? 0;
  const exposure = s.total_exposure ?? 0;
  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  let summary = "";
  if (high > 0 && risks[0]) {
    const top = risks[0];
    summary = `You have ${high} high-risk event${high !== 1 ? "s" : ""} detected.`;
    summary += ` The most important is ${top.provider} ${top.object} — ${(top.risk_type ?? "").replace(/_/g, " ")}.`;
    if (!top.approved_at) summary += ` This change has not been approved yet${top.impact_amount ? ` and could affect ${fmt(top.impact_amount)} in revenue.` : "."}`;
    else summary += " Approval granted.";
  } else if (unapproved > 0) {
    summary = `You have ${unapproved} unapproved change${unapproved !== 1 ? "s" : ""}.${exposure > 0 ? ` Total revenue exposure: ${fmt(exposure)}.` : ""}`;
  } else if (risks.length === 0) summary = "No revenue risk detected recently. Connect Jira to begin monitoring pricing and billing changes.";
  else summary = `Revenue exposure today: ${fmt(exposure)}. ${s.compliance_pct ?? 100}% governance compliance.`;

  const actions: string[] = [];
  if (high > 0 && risks[0] && !risks[0].approved_at) {
    actions.push("Review the change request", "Request approval from Finance");
    if (!risks[0].change_event_id) actions.push("Link this to an existing change request");
  }
  if (unapproved > 0 && !actions.length) actions.push("Review unapproved changes");
  const alerts: string[] = [];
  if (high > 0 && unapproved > 0) alerts.push(`${high} high-risk event(s) need attention`);
  if (s.compliance_pct != null && s.compliance_pct < 90) alerts.push("Governance compliance below 90%");
  return { summary, recommended_actions: actions, alerts };
}

const endpoint = "/api/ai/copilot-context";

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: Body;
  try { body = (await req.json()) as Body; } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { allowed: withinLimit } = await checkAiDailyLimit(supabase);
  if (!withinLimit) {
    return NextResponse.json(
      { error: "AI daily request limit reached. Try again tomorrow." },
      { status: 429 }
    );
  }

  const openai = getOpenAI();
  if (!openai) {
    const fallback = ruleFallback(body);
    await logAiRequest(supabase, {
      endpoint,
      inputSummary: body.page ?? "dashboard",
      outputSummary: fallback.summary.slice(0, 200),
      latencyMs: null,
      status: "disabled",
      userId: userRes.user.id,
    });
    return NextResponse.json({ ok: true, ...fallback });
  }

  const input = { page: body.page ?? "dashboard", dashboard_state: body.dashboard_state ?? {}, risk_events: (body.risk_events ?? []).slice(0, 5), change_requests: (body.change_requests ?? []).slice(0, 5) };
  const system = `You are the Revenue Risk Copilot. Given dashboard state and risk events, output ONLY valid JSON: { "summary": "2-4 sentences", "recommended_actions": ["action1","action2"], "alerts": ["alert1"] }. Be concise and actionable.`;
  const start = Date.now();
  try {
    const resp = await openai.chat.completions.create({ model: "gpt-4o-mini", messages: [{ role: "system", content: system }, { role: "user", content: JSON.stringify(input) }] });
    const latencyMs = Date.now() - start;
    const raw = resp.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { summary?: string; recommended_actions?: string[]; alerts?: string[] };
    const summary = parsed.summary ?? ruleFallback(body).summary;
    await logAiRequest(supabase, {
      endpoint,
      inputSummary: body.page ?? "dashboard",
      outputSummary: summary.slice(0, 200),
      latencyMs,
      status: "ok",
      userId: userRes.user.id,
    });
    return NextResponse.json({ ok: true, summary, recommended_actions: Array.isArray(parsed.recommended_actions) ? parsed.recommended_actions : [], alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [] });
  } catch {
    const latencyMs = Date.now() - start;
    const fallback = ruleFallback(body);
    await logAiRequest(supabase, {
      endpoint,
      inputSummary: body.page ?? "dashboard",
      outputSummary: null,
      latencyMs,
      status: "error",
      userId: userRes.user.id,
    });
    return NextResponse.json({ ok: true, ...fallback });
  }
}
