/**
 * AI Risk Explanation
 * Plain-language explanation of why a risk event matters.
 * Executives love this.
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOpenAI } from "@/lib/openai";
import { logAiRequest, checkAiDailyLimit } from "@/lib/ai/log-request";

type Body = { risk_event_id: string };

const endpoint = "/api/ai/risk-explain";

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
  if (!body.risk_event_id)
    return NextResponse.json(
      { error: "risk_event_id required" },
      { status: 400 }
    );

  const { data: event, error } = await supabase
    .from("risk_events")
    .select("id, provider, object, risk_type, risk_score, impact_amount, field, old_value, new_value, timestamp")
    .eq("id", body.risk_event_id)
    .single();

  if (error || !event)
    return NextResponse.json(
      { error: error?.message ?? "Risk event not found" },
      { status: 404 }
    );

  const { allowed: withinLimit } = await checkAiDailyLimit(supabase);
  if (!withinLimit) {
    return NextResponse.json(
      { error: "AI daily request limit reached. Try again tomorrow." },
      { status: 429 }
    );
  }

  const openai = getOpenAI();
  if (!openai) {
    await logAiRequest(supabase, {
      endpoint,
      inputSummary: body.risk_event_id,
      outputSummary: null,
      latencyMs: null,
      status: "disabled",
      userId: userRes.user.id,
    });
    return NextResponse.json(
      { error: "AI integration disabled: OPENAI_API_KEY not configured" },
      { status: 503 }
    );
  }

  const payload = {
    provider: event.provider,
    object: event.object,
    risk_type: event.risk_type,
    risk_score: event.risk_score,
    impact_amount: event.impact_amount,
    field: event.field,
    old_value: event.old_value,
    new_value: event.new_value,
  };

  const system = `You are a revenue risk analyst. Explain in 1-3 short sentences why this risk event matters in plain language.
Focus on: what changed, why it could affect revenue, and potential impact.
Be concise and executive-friendly. No jargon.
Output ONLY the explanation text, no JSON.`;

  const start = Date.now();
  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(payload) },
      ],
    });
    const latencyMs = Date.now() - start;
    const explanation =
      resp.choices?.[0]?.message?.content?.trim() ??
      `Solvren detected a ${event.risk_type.replace(/_/g, " ").toLowerCase()} from ${event.provider}. ${
        event.impact_amount
          ? `Potential revenue impact: $${Number(event.impact_amount).toLocaleString()}.`
          : "Review recommended."
      }`;
    await logAiRequest(supabase, {
      endpoint,
      inputSummary: body.risk_event_id,
      outputSummary: explanation.slice(0, 200),
      latencyMs,
      status: "ok",
      userId: userRes.user.id,
    });
    return NextResponse.json({
      ok: true,
      explanation,
    });
  } catch (err) {
    const latencyMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : "AI error";
    await logAiRequest(supabase, {
      endpoint,
      inputSummary: body.risk_event_id,
      outputSummary: msg,
      latencyMs,
      status: "error",
      userId: userRes.user.id,
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
