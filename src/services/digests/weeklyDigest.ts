import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import type { SupabaseClient } from "@supabase/supabase-js";

function fmtMoney(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(v);
  } catch {
    return `$${Math.round(v).toLocaleString()}`;
  }
}

type ChangeRow = {
  id: string;
  title: string | null;
  status: string | null;
  submitted_at: string | null;
  due_at: string | null;
  sla_status: string | null;
  risk_score: number | null;
  revenue_at_risk: number | null;
  revenue_surface: string | null;
};

export async function buildWeeklyDigest(
  supabase: SupabaseClient,
  args: { orgId: string }
) {
  const { orgId } = args;

  const sinceIso = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: changesRaw, error } = await scopeActiveChangeEvents(supabase.from("change_events").select(
      "id, title, status, submitted_at, due_at, sla_status, revenue_at_risk, revenue_surface"
    ))
    .eq("org_id", orgId)
    .gte("submitted_at", sinceIso);

  if (error) throw new Error(error.message);

  const changeIds = (changesRaw ?? []).map((c) => c.id).filter(Boolean);
  let riskByChange = new Map<string, number>();
  if (changeIds.length > 0) {
    const { data: assessments } = await supabase
      .from("impact_assessments")
      .select("change_event_id, risk_score_raw")
      .in("change_event_id", changeIds)
      .order("created_at", { ascending: false });
    const latestByChange = new Map<string, number>();
    for (const a of assessments ?? []) {
      const id = String(a.change_event_id);
      if (!latestByChange.has(id)) {
        latestByChange.set(id, Number(a.risk_score_raw ?? 0));
      }
    }
    riskByChange = latestByChange;
  }

  const rows: ChangeRow[] = (changesRaw ?? []).map((c: Record<string, unknown>) => ({
    id: String(c.id),
    title: (c.title as string) ?? null,
    status: (c.status as string) ?? null,
    submitted_at: (c.submitted_at as string) ?? null,
    due_at: (c.due_at as string) ?? null,
    sla_status: (c.sla_status as string) ?? null,
    risk_score: riskByChange.get(String(c.id)) ?? null,
    revenue_at_risk: c.revenue_at_risk != null ? Number(c.revenue_at_risk) : null,
    revenue_surface: (c.revenue_surface as string) ?? null,
  }));

  const pending = rows.filter(
    (c) =>
      !["APPROVED", "REJECTED", "CLOSED", "RESOLVED"].includes(
        String(c.status ?? "")
      )
  );

  const revenueAtRisk7d = pending.reduce(
    (acc, c) => acc + (c.revenue_at_risk ?? 0),
    0
  );

  const critical = pending
    .filter((c) => (c.risk_score ?? 0) >= 75)
    .sort((a, b) => (b.revenue_at_risk ?? 0) - (a.revenue_at_risk ?? 0))
    .slice(0, 5);

  const overdue = pending
    .filter((c) => String(c.sla_status ?? "") === "OVERDUE")
    .sort((a, b) => (b.revenue_at_risk ?? 0) - (a.revenue_at_risk ?? 0))
    .slice(0, 5);

  const bySurface: Record<string, number> = {};
  for (const c of pending) {
    const k = (c.revenue_surface ?? "UNSPECIFIED").toUpperCase();
    bySurface[k] = (bySurface[k] || 0) + (c.revenue_at_risk ?? 0);
  }
  const topSurfaces = Object.entries(bySurface)
    .map(([surface, revenueAtRisk]) => ({ surface, revenueAtRisk }))
    .sort((a, b) => b.revenueAtRisk - a.revenueAtRisk)
    .slice(0, 5);

  const blocks: Record<string, unknown>[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "Weekly Revenue Risk Digest",
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Revenue at Risk (7d)*\n${fmtMoney(revenueAtRisk7d)}`,
        },
        {
          type: "mrkdwn",
          text: `*Pending changes*\n${pending.length}`,
        },
      ],
    },
    { type: "divider" },
  ];

  if (critical.length) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: "*Top critical pending*" },
    });
    for (const c of critical) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `• *${(c.title || "Untitled").replace(/[<>]/g, "")}* — ${fmtMoney(c.revenue_at_risk ?? 0)} (Risk ${Math.round(c.risk_score ?? 0)})`,
        },
      });
    }
    blocks.push({ type: "divider" });
  }

  if (overdue.length) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: "*Top overdue*" },
    });
    for (const c of overdue) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `• *${(c.title || "Untitled").replace(/[<>]/g, "")}* — ${fmtMoney(c.revenue_at_risk ?? 0)} (OVERDUE)`,
        },
      });
    }
    blocks.push({ type: "divider" });
  }

  if (topSurfaces.length) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: "*Exposure by surface*" },
    });
    for (const s of topSurfaces) {
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `• *${s.surface}*: ${fmtMoney(s.revenueAtRisk)}`,
          },
        ],
      });
    }
  }

  const emailSubject = `Weekly Revenue Risk Digest — ${fmtMoney(revenueAtRisk7d)} at risk`;
  const emailText =
    `Revenue at Risk (7d): ${fmtMoney(revenueAtRisk7d)}\n` +
    `Pending changes: ${pending.length}\n\n` +
    `Top critical pending:\n` +
    (critical.length
      ? critical
          .map(
            (c) =>
              `- ${(c.title || "Untitled")}: ${fmtMoney(c.revenue_at_risk ?? 0)} (Risk ${Math.round(c.risk_score ?? 0)})`
          )
          .join("\n")
      : "- none") +
    `\n\nTop overdue:\n` +
    (overdue.length
      ? overdue
          .map(
            (c) =>
              `- ${(c.title || "Untitled")}: ${fmtMoney(c.revenue_at_risk ?? 0)} (OVERDUE)`
          )
          .join("\n")
      : "- none") +
    `\n\nExposure by surface:\n` +
    (topSurfaces.length
      ? topSurfaces
          .map((s) => `- ${s.surface}: ${fmtMoney(s.revenueAtRisk)}`)
          .join("\n")
      : "- none");

  return {
    revenueAtRisk7d,
    pendingCount: pending.length,
    blocks,
    emailSubject,
    emailText,
  };
}
