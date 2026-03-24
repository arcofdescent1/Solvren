import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getReadyStatus } from "@/services/risk/readyStatus";
import { fetchMitigationsForSignals } from "@/services/risk/mitigationsDb";

type SignalRow = {
  signal_key: string;
  category: string | null;
  contribution: number | null;
  source: string | null;
};

type LearnedDetail = {
  signalKey: string;
  learnedMultiplier: number;
  reason?: unknown;
  totalChanges?: unknown;
  incidentChanges?: unknown;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatPct(n: number) {
  const v = Math.round(n * 100);
  return `${v}%`;
}

export type RiskExplainResponse = {
  model: string | null;
  finalRisk: number | null;
  bucket: string | null;
  domain: string | null;
  narrative: string;
  topDrivers: Array<{
    signalKey: string;
    contribution: number | null;
    category: string | null;
    learnedMultiplier: number | null;
    learnedIncidentRate?: string | null;
  }>;
  whatWouldReduceRisk: Array<{
    signalKey: string;
    severity: string;
    recommendation: string;
  }>;
  fastestEvidenceToUnblock: Array<{
    kind: string;
    why: string;
  }>;
};

export async function explainRiskScore(
  supabase: SupabaseClient,
  args: { changeId: string }
): Promise<RiskExplainResponse> {
  const { changeId } = args;

  const { data: change, error: chErr } = await scopeActiveChangeEvents(supabase.from("change_events").select("id, org_id, domain, risk_explanation"))
    .eq("id", changeId)
    .maybeSingle();
  if (chErr) throw new Error(chErr.message);
  if (!change) throw new Error("Change not found");

  const orgId = change.org_id as string;
  const domain = (change.domain ?? null) as string | null;

  const { data: assessment } = await supabase
    .from("impact_assessments")
    .select("risk_bucket, risk_score_raw, created_at")
    .eq("change_event_id", changeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const bucket = (assessment?.risk_bucket ?? null) as string | null;

  const { data: signals } = await supabase
    .from("risk_signals")
    .select("signal_key, category, contribution, source")
    .eq("change_event_id", changeId)
    .order("contribution", { ascending: false })
    .limit(30);

  const signalRows = (signals ?? []) as unknown as SignalRow[];
  const top = [...signalRows]
    .filter((s) => (s.contribution ?? 0) !== 0)
    .sort((a, b) => (b.contribution ?? 0) - (a.contribution ?? 0))
    .slice(0, 8);

  const signalKeys = top.map((t) => String(t.signal_key)).filter(Boolean);

  const rx = (change as { risk_explanation?: unknown }).risk_explanation;
  const learnedDetails: LearnedDetail[] =
    rx && typeof rx === "object" && Array.isArray((rx as { learnedDetails?: LearnedDetail[] }).learnedDetails)
      ? (rx as { learnedDetails: LearnedDetail[] }).learnedDetails
      : [];

  const learnedMap = new Map<string, LearnedDetail>();
  for (const d of learnedDetails) learnedMap.set(String(d.signalKey), d);

  const topDrivers = top.map((t) => {
    const ld = learnedMap.get(String(t.signal_key));
    let learnedIncidentRate: string | null = null;
    if (ld?.totalChanges != null && ld?.incidentChanges != null) {
      const total = Number(ld.totalChanges);
      const inc = Number(ld.incidentChanges);
      if (Number.isFinite(total) && total > 0 && Number.isFinite(inc) && inc >= 0) {
        learnedIncidentRate = `${inc}/${total} (${formatPct(inc / total)})`;
      }
    }
    return {
      signalKey: String(t.signal_key),
      contribution: t.contribution ?? null,
      category: t.category ?? null,
      learnedMultiplier: ld ? clamp(Number(ld.learnedMultiplier ?? 1), 0.1, 10) : null,
      learnedIncidentRate,
    };
  });

  const mitigations = await fetchMitigationsForSignals(supabase, {
    orgId,
    domain: domain ?? "REVENUE",
    signalKeys,
  });

  const sevRank: Record<string, number> = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };
  mitigations.sort((a, b) => (sevRank[b.severity] ?? 0) - (sevRank[a.severity] ?? 0));

  const whatWouldReduceRisk = mitigations.slice(0, 10).map((m) => ({
    signalKey: m.signalKey,
    severity: m.severity,
    recommendation: m.recommendation,
  }));

  const ready = await getReadyStatus(supabase, { changeId });

  const fastestEvidenceToUnblock = (ready.missingEvidence ?? []).slice(0, 5).map((k) => ({
    kind: k,
    why:
      k === "ROLLBACK"
        ? "Rollback plan is a common hard blocker for high-risk changes."
        : k === "DASHBOARD"
          ? "Monitoring/validation dashboards reduce uncertainty immediately after release."
          : k === "COMMS_PLAN"
            ? "Comms plan prevents customer-facing surprises if impact occurs."
            : "Completing required evidence unblocks approvals and reduces risk ambiguity.",
  }));

  const model = rx && typeof rx === "object" ? String((rx as { model?: string }).model ?? "") : null;
  const finalRisk =
    rx && typeof rx === "object" && (rx as { finalRisk?: number }).finalRisk != null
      ? Number((rx as { finalRisk: number }).finalRisk)
      : assessment?.risk_score_raw != null
        ? Number(assessment.risk_score_raw)
        : null;

  const narrativeLines: string[] = [];
  narrativeLines.push(
    "Risk score is computed from a base assessment, multiplied by (1) learned historical risk for detected signals and (2) revenue exposure."
  );
  if (finalRisk != null && bucket) {
    narrativeLines.push(`Current score: ${Math.round(finalRisk)} (${bucket}).`);
  } else if (finalRisk != null) {
    narrativeLines.push(`Current score: ${Math.round(finalRisk)}.`);
  }

  if (topDrivers.length) {
    const drivers = topDrivers
      .slice(0, 3)
      .map(
        (d) =>
          `${d.signalKey}${d.learnedMultiplier ? ` (learned x${d.learnedMultiplier.toFixed(2)})` : ""}`
      )
      .join(", ");
    narrativeLines.push(`Top drivers: ${drivers}.`);
  }

  if (whatWouldReduceRisk.length) {
    narrativeLines.push(
      `Best risk reducers: ${whatWouldReduceRisk
        .slice(0, 3)
        .map((m) => m.recommendation)
        .join(" ")}`
    );
  }

  if (fastestEvidenceToUnblock.length) {
    narrativeLines.push(
      `Fastest evidence to unblock: ${fastestEvidenceToUnblock.map((e) => e.kind).join(", ")}.`
    );
  }

  return {
    model,
    finalRisk: finalRisk != null && Number.isFinite(finalRisk) ? Math.round(finalRisk) : null,
    bucket,
    domain,
    narrative: narrativeLines.join(" "),
    topDrivers,
    whatWouldReduceRisk,
    fastestEvidenceToUnblock,
  };
}
