/**
 * AI Change Request Assistant
 * Suggest change fields from Jira issue text.
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOpenAI } from "@/lib/openai";
import { logAiRequest, checkAiDailyLimit } from "@/lib/ai/log-request";
import { getActiveOrg } from "@/lib/org/activeOrg";

type Body = { jira_issue_text: string };

const endpoint = "/api/ai/change-assist";

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
  const text = String(body.jira_issue_text ?? "").trim();
  if (!text)
    return NextResponse.json({ error: "jira_issue_text required" }, { status: 400 });

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
      inputSummary: text.slice(0, 200),
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

  const system = `You are a revenue governance assistant. Given a Jira issue or change description, suggest:
1. change_type: one of PRICING_CHANGE, BILLING_LOGIC_CHANGE, PAYMENT_FLOW_CHANGE, SUBSCRIPTION_LIFECYCLE_CHANGE, PROMOTION_DISCOUNT_CHANGE, TAX_CHANGE, INTEGRATION_CHANGE, OTHER
2. system: primary system (e.g. Stripe, Billing)
3. impact_band: one of "<$10k", "$10k-$100k", "$100k-$1M", "$1M+"
4. required_evidence: array of evidence types from: TEST_PLAN, ROLLBACK, RUNBOOK, DASHBOARD, PR
5. plain_summary: one-sentence plain language summary

Respond with ONLY valid JSON: { "change_type": "...", "system": "...", "impact_band": "...", "required_evidence": [], "plain_summary": "..." }`;

  const start = Date.now();
  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: text },
      ],
    });
    const latencyMs = Date.now() - start;
    const raw = resp.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const payload = {
      ok: true,
      suggested_fields: {
        change_type: parsed.change_type ?? "OTHER",
        system: parsed.system ?? null,
        impact_band: parsed.impact_band ?? null,
      },
      risk_estimate: parsed.impact_band ?? null,
      required_evidence: Array.isArray(parsed.required_evidence) ? parsed.required_evidence : [],
      plain_summary: parsed.plain_summary ?? null,
    };
    const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
    await logAiRequest(supabase, {
      endpoint,
      inputSummary: text.slice(0, 200),
      outputSummary: String(parsed.plain_summary ?? "").slice(0, 200),
      latencyMs,
      status: "ok",
      userId: userRes.user.id,
      orgId: activeOrgId ?? undefined,
    });
    return NextResponse.json(payload);
  } catch (err) {
    const latencyMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : "AI error";
    await logAiRequest(supabase, {
      endpoint,
      inputSummary: text.slice(0, 200),
      outputSummary: msg,
      latencyMs,
      status: "error",
      userId: userRes.user.id,
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
