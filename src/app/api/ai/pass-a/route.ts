import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOpenAI } from "@/lib/openai";
import { PassASchema } from "@/services/ai/passA.schema";

type Body = { changeEventId: string };

function compactInput(
  change: Record<string, unknown>,
  signals: Record<string, unknown>[],
  evidence: Record<string, unknown>[]
) {
  const intake = (change.intake as Record<string, unknown>) ?? {};
  return {
    change: {
      id: change.id,
      title: change.title,
      change_type: change.change_type,
      description: (intake.description as string) ?? "",
      systems: change.systems_involved ?? [],
      impact_areas: change.revenue_impact_areas ?? [],
      impacts_active_customers: change.impacts_active_customers ?? null,
      requested_release_at: change.requested_release_at ?? null,
    },
    deterministic_signals: (signals ?? [])
      .filter((s) => s.source === "RULE")
      .map((s) => ({
        key: s.signal_key,
        type: s.value_type,
        bool: s.value_bool,
        num: s.value_num,
        contribution: s.contribution ?? null,
        category: s.category,
      })),
    evidence_kinds_present: Array.from(
      new Set((evidence ?? []).map((e) => e.kind))
    ),
  };
}

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
    .select("*, domain")
    .eq("id", body.changeEventId)
    .single();

  if (ceErr || !change)
    return NextResponse.json(
      { error: ceErr?.message ?? "Change not found" },
      { status: 404 }
    );

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", change.org_id)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member)
    return NextResponse.json(
      { error: "Not a member of this organization" },
      { status: 403 }
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

  const { data: signals } = await supabase
    .from("risk_signals")
    .select(
      "signal_key, value_type, value_bool, value_num, category, source, contribution"
    )
    .eq("change_event_id", body.changeEventId);

  const { data: evidence } = await supabase
    .from("change_evidence")
    .select("kind")
    .eq("change_event_id", body.changeEventId);

  const input = compactInput(
    change as Record<string, unknown>,
    (signals ?? []) as Record<string, unknown>[],
    (evidence ?? []) as Record<string, unknown>[]
  );

  const existingKeys = new Set((signals ?? []).map((s) => s.signal_key));

  const changeDomain = (change.domain ?? "REVENUE") as string;
  const system = [
    "You are an operational change-risk analyst.",
    `This change domain is ${changeDomain}.`,
    "Return ONLY JSON that matches the provided schema.",
    "Do NOT invent evidence; if uncertain, lower confidence.",
    "Prefer proposing signals that are not already present in deterministic_signals.",
    "Keep reasons short and concrete.",
  ].join(" ");

  const model = "gpt-4o-mini";

  const openai = getOpenAI();
  if (!openai) {
    return NextResponse.json(
      { error: "AI integration disabled: OPENAI_API_KEY not configured" },
      { status: 503 }
    );
  }

  let resp;
  try {
    resp = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            "Analyze this change intake and deterministic signals.",
            "Propose additional risk signals that should be considered.",
            "Output must match schema.",
            "",
            JSON.stringify(input),
          ].join("\n"),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: PassASchema,
      } as const,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "OpenAI API error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const raw = resp.choices?.[0]?.message?.content ?? "";
  let passA: Record<string, unknown>;
  try {
    passA = JSON.parse(raw) as Record<string, unknown>;
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
      pass_a_output: passA,
      pass_a_model: model,
      pass_a_ran_at: ranAt,
    })
    .eq("id", assessment.id);

  if (updErr)
    return NextResponse.json({ error: updErr.message }, { status: 500 });

  const aiSignals = ((passA.signals as Record<string, unknown>[]) ?? [])
    .filter(
      (s): s is Record<string, unknown> =>
        !!s?.signal_key && !existingKeys.has(s.signal_key as string)
    )
    .map((s) => {
      const changeDomain = (change.domain ?? "REVENUE") as string;
      const base: Record<string, unknown> = {
        change_event_id: body.changeEventId,
        domain: changeDomain,
        signal_key: s.signal_key,
        value_type: s.value_type,
        category: s.category,
        source: "AI",
        confidence: s.confidence,
        rationale: s.reason,
      };

      if (s.value_type === "BOOLEAN") base.value_bool = Boolean(s.value);
      if (s.value_type === "NUMBER") base.value_num = Number(s.value);
      if (s.value_type === "TEXT") base.value_text = String(s.value ?? "");

      return base;
    });

  if (aiSignals.length > 0) {
    const { error: insErr } = await supabase
      .from("risk_signals")
      .insert(aiSignals);
    if (insErr)
      return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  const baseUrl = new URL(req.url).origin;
  const computeResp = await fetch(`${baseUrl}/api/assessments/compute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: req.headers.get("cookie") ?? "",
    },
    body: JSON.stringify({ changeEventId: body.changeEventId }),
  });

  if (!computeResp.ok) {
    const j = await computeResp.json().catch(() => ({}));
    return NextResponse.json(
      {
        error:
          (j as { error?: string })?.error ?? "Failed to recompute after AI",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    insertedSignals: aiSignals.length,
  });
}
