/**
 * Gap 7: Revenue Risk Briefing — AI-generated instant value moment.
 * GET /api/ai/risk-briefing
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { getOpenAI } from "@/lib/openai";
import { sortByPriority } from "@/lib/risk/prioritize";
import { getIntegrationsList } from "@/lib/integrations/list";
import { createAdminClient } from "@/lib/supabase/admin";

const BRIEFING_TIMEOUT_MS = 2000;

type RiskRow = {
  id: string;
  provider: string;
  object: string;
  object_id: string;
  risk_type: string;
  impact_amount: number | null;
  risk_score: number;
  approved_at: string | null;
  change_event_id: string | null;
  timestamp: string;
  confidence_level: string | null;
};

function fallbackBriefing(top: RiskRow | null, exposure: number): {
  headline: string;
  summary: string;
  estimatedExposure: number;
  source: string;
  recommendedAction: string;
} {
  if (!top) {
    return {
      headline: "No revenue risks detected",
      summary: "No open revenue risks in the last 7 days.",
      estimatedExposure: 0,
      source: "-",
      recommendedAction: "Keep monitoring connected systems.",
    };
  }
  const impactStr = Number.isFinite(Number(top.impact_amount))
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(top.impact_amount))
    : null;
  const source = top.object_id ? `${top.provider} ${top.object_id}` : `${top.provider} ${top.object}`;
  return {
    headline: `Unapproved ${(top.risk_type ?? "").replace(/_/g, " ").toLowerCase()} from ${top.provider}`,
    summary: `A change detected in ${top.provider} may affect revenue. ${impactStr ? `Estimated exposure: ${impactStr}.` : ""}`,
    estimatedExposure: Number(top.impact_amount) || 0,
    source,
    recommendedAction: top.change_event_id
      ? "Review the linked change request or mark the change as approved."
      : "Link to a governed change or create a new change to track approval.",
  };
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);

  const since = new Date();
  since.setDate(since.getDate() - 7);

  let riskRows: RiskRow[] = [];
  let revenueExposure = 0;
  let integrationsConnected = false;

  if (activeOrgId) {
    const { data: reRows } = await supabase
      .from("risk_events")
      .select("id, provider, object, object_id, risk_type, impact_amount, risk_score, approved_at, change_event_id, timestamp, confidence_level")
      .eq("org_id", activeOrgId)
      .gte("timestamp", since.toISOString())
      .order("timestamp", { ascending: false })
      .limit(50);

    riskRows = (reRows ?? []) as RiskRow[];
    for (const e of riskRows) {
      if (!e.approved_at && Number.isFinite(Number(e.impact_amount)))
        revenueExposure += Number(e.impact_amount);
    }

    try {
      const admin = createAdminClient();
      const list = await getIntegrationsList(admin, activeOrgId);
      integrationsConnected = ["jira", "github", "slack", "salesforce", "hubspot", "netsuite"].some(
        (p) => (list as Record<string, { connected: boolean }>)[p]?.connected
      );
    } catch {
      // ignore
    }
  }

  const openRisks = riskRows.filter((r) => !r.approved_at);
  const sorted = sortByPriority(openRisks);
  const topRisk = sorted[0] ?? null;

  const mode: "risk" | "empty" | "demo" =
    !activeOrgId || !integrationsConnected
      ? "demo"
      : openRisks.length === 0
        ? "empty"
        : "risk";

  const base = {
    mode,
    topRiskId: topRisk?.id ?? null,
    revenueExposure,
    integrationsConnected,
    monitoring: ["Jira", "Salesforce", "NetSuite", "Slack"],
  };

  if (mode === "demo") {
    return NextResponse.json({
      ...base,
      headline: "Example risk detected (demo)",
      summary: "A pricing tier update changed billing rules for enterprise subscriptions. This is sample data to show how Solvren surfaces risk.",
      estimatedExposure: 275000,
      source: "Jira (demo mode)",
      recommendedAction: "Connect Jira and other systems to see real revenue risks.",
    });
  }

  if (mode === "empty") {
    return NextResponse.json({
      ...base,
      headline: "Good news",
      summary: "No revenue risks detected across your connected systems.",
      estimatedExposure: 0,
  source: "-",
  recommendedAction: "Solvren is actively monitoring. Risks will appear here when detected.",
      monitoring: ["Jira", "Salesforce", "NetSuite", "Slack"],
    });
  }

  const openai = getOpenAI();
  if (!openai) {
    const fallback = fallbackBriefing(topRisk, revenueExposure);
    return NextResponse.json({ ...base, ...fallback });
  }

  const input = {
    top_risk_events: sorted.slice(0, 3).map((r) => ({
      id: r.id,
      provider: r.provider,
      object: r.object,
      object_id: r.object_id,
      risk_type: r.risk_type,
      impact_amount: r.impact_amount,
    })),
    revenue_exposure: revenueExposure,
    top_risk: topRisk
      ? {
          id: topRisk.id,
          provider: topRisk.provider,
          object: topRisk.object,
          object_id: topRisk.object_id,
          risk_type: topRisk.risk_type,
          impact_amount: topRisk.impact_amount,
          change_event_id: topRisk.change_event_id,
        }
      : null,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BRIEFING_TIMEOUT_MS);

  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are the Revenue Risk Briefing. Given the top risk event, output ONLY valid JSON: {
  "headline": "Short headline (e.g. A pricing configuration change detected in Jira may affect billing.)",
  "summary": "1-2 sentences for the briefing.",
  "estimatedExposure": number (from impact_amount),
  "source": "e.g. Jira Issue PROJ-4821 or provider + object_id",
  "recommendedAction": "One sentence: e.g. Review linked change request or mark as approved."
}. Be concise and executive-friendly.`,
        },
        { role: "user", content: JSON.stringify(input) },
      ],
    }, { signal: controller.signal });

    clearTimeout(timeoutId);
    const raw = resp.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as {
      headline?: string;
      summary?: string;
      estimatedExposure?: number;
      source?: string;
      recommendedAction?: string;
    };

    return NextResponse.json({
      ...base,
      headline: parsed.headline ?? fallbackBriefing(topRisk, revenueExposure).headline,
      summary: parsed.summary ?? fallbackBriefing(topRisk, revenueExposure).summary,
      estimatedExposure: typeof parsed.estimatedExposure === "number" ? parsed.estimatedExposure : (topRisk?.impact_amount ? Number(topRisk.impact_amount) : 0),
      source: parsed.source ?? (topRisk?.object_id ? `${topRisk.provider} ${topRisk.object_id}` : topRisk?.provider ?? "-"),
      recommendedAction: parsed.recommendedAction ?? fallbackBriefing(topRisk, revenueExposure).recommendedAction,
    });
  } catch {
    clearTimeout(timeoutId);
    const fallback = fallbackBriefing(topRisk, revenueExposure);
    return NextResponse.json({ ...base, ...fallback });
  }
}
