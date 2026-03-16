import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOpenAI } from "@/lib/openai";
import { SuggestEvidenceSchema } from "@/services/ai/suggestEvidence.schema";
import {
  REQUIRED_EVIDENCE_BY_BUCKET,
  type RiskBucket,
} from "@/services/risk/requirements";

type Body = { changeEventId: string };

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
  if (!body.changeEventId)
    return NextResponse.json(
      { error: "Missing changeEventId" },
      { status: 400 }
    );

  const { data: change, error: ceErr } = await supabase
    .from("change_events")
    .select("id, title, change_type, intake")
    .eq("id", body.changeEventId)
    .single();

  if (ceErr || !change)
    return NextResponse.json(
      { error: ceErr?.message ?? "Change not found" },
      { status: 404 }
    );

  const { data: assessment, error: aErr } = await supabase
    .from("impact_assessments")
    .select("id, risk_bucket")
    .eq("change_event_id", body.changeEventId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (aErr || !assessment?.id)
    return NextResponse.json(
      { error: aErr?.message ?? "No assessment" },
      { status: 400 }
    );

  const bucket = (assessment.risk_bucket ?? "MEDIUM") as RiskBucket;
  const required = REQUIRED_EVIDENCE_BY_BUCKET[bucket] ?? [];

  const { data: evidence } = await supabase
    .from("change_evidence")
    .select("kind, label, url")
    .eq("change_event_id", body.changeEventId);

  const present = new Set((evidence ?? []).map((e) => e.kind));
  const missing = required.filter((k) => !present.has(k));

  // If nothing missing, store empty and return ok.
  if (missing.length === 0) {
    await supabase
      .from("impact_assessments")
      .update({
        missing_evidence_suggestions: {
          version: "1.0",
          missing_kinds: [],
          suggestions: [],
        },
        suggested_evidence_ran_at: new Date().toISOString(),
      })
      .eq("id", assessment.id);

    return NextResponse.json({ ok: true, missing: 0 });
  }

  const intake = (change.intake as Record<string, unknown>) ?? {};
  const input = {
    change: {
      title: change.title,
      change_type: change.change_type,
      description: intake.description ?? "",
      systems: intake.systemsInvolved ?? [],
      impact_areas: intake.revenueImpactAreas ?? [],
    },
    risk_bucket: bucket,
    required_kinds: required,
    missing_kinds: missing,
    evidence_present: (evidence ?? []).map((e) => ({
      kind: e.kind,
      label: e.label,
      url: e.url,
    })),
  };

  const openai = getOpenAI();
  if (!openai) {
    return NextResponse.json(
      { error: "AI integration disabled: OPENAI_API_KEY not configured" },
      { status: 503 }
    );
  }

  const system =
    "You are a change-management reviewer. Suggest what evidence artifacts to attach. Keep suggestions concrete and short. Output ONLY JSON matching schema.";

  const model = "gpt-4o-mini";

  const resp = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(input) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: SuggestEvidenceSchema,
    } as const,
  });

  const content = resp.choices?.[0]?.message?.content ?? "";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "AI returned invalid JSON (unexpected)" },
      { status: 500 }
    );
  }

  const ranAt = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("impact_assessments")
    .update({
      missing_evidence_suggestions: parsed,
      suggested_evidence_ran_at: ranAt,
    })
    .eq("id", assessment.id);

  if (updErr)
    return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    missing: missing.length,
    suggestions: parsed.suggestions ?? [],
  });
}
