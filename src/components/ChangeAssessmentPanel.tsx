"use client";;
import { Button } from "@/ui";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { mitigationForCategory, prettyCategory } from "@/services/risk/mitigations";

type SignalRow = {
  id: string;
  signal_key: string;
  value_type: "BOOLEAN" | "NUMBER";
  value_bool: boolean | null;
  value_num: number | null;
  source: string;
  category: string;
  weight_at_time: number;
  contribution: number;
};

export default function ChangeAssessmentPanel({
  changeEventId,
  signals,
  assessment,
}: {
  changeEventId: string;
  signals: SignalRow[];
  assessment: {
    status?: string | null;
    risk_score_raw?: number | null;
    risk_bucket?: string | null;
    pass_a_output?: { summary?: { risk_narrative?: string; key_concerns?: string[] } } | null;
  } | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const contributingSignals = useMemo(() => {
    return (signals ?? []).filter((s) => (s.contribution ?? 0) !== 0);
  }, [signals]);

  const topContributors = useMemo(() => {
    return [...contributingSignals]
      .sort((a, b) => (b.contribution ?? 0) - (a.contribution ?? 0))
      .slice(0, 10);
  }, [contributingSignals]);

  const breakdown = useMemo(() => {
    const map = new Map<
      string,
      { category: string; total: number; items: SignalRow[] }
    >();

    for (const s of contributingSignals) {
      const cat = s.category ?? "UNKNOWN";
      const entry = map.get(cat) ?? { category: cat, total: 0, items: [] };
      entry.total += s.contribution ?? 0;
      entry.items.push(s);
      map.set(cat, entry);
    }

    const groups = Array.from(map.values()).map((g) => ({
      ...g,
      items: [...g.items].sort(
        (a, b) => (b.contribution ?? 0) - (a.contribution ?? 0)
      ),
    }));

    groups.sort((a, b) => (b.total ?? 0) - (a.total ?? 0));

    return groups;
  }, [contributingSignals]);

  async function recompute() {
    setMsg(null);
    setLoading(true);

    const resp = await fetch("/api/assessments/compute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changeEventId }),
    });

    const json = await resp.json().catch(() => ({}));

    setLoading(false);

    if (!resp.ok) {
      setMsg(json?.error ?? "Failed to recompute.");
      return;
    }

    router.refresh();
  }

  async function generateChecklist() {
    setMsg(null);
    setLoading(true);

    const resp = await fetch("/api/assessments/generate-checklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changeEventId }),
    });

    const json = await resp.json().catch(() => ({}));
    setLoading(false);

    if (!resp.ok) {
      setMsg(json?.error ?? "Failed to generate checklist.");
      return;
    }

    setMsg("Checklist generated.");
    router.refresh();
  }

  async function runPassA() {
    setMsg(null);
    setLoading(true);

    const resp = await fetch("/api/ai/pass-a", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changeEventId }),
    });

    const json = await resp.json().catch(() => ({}));
    setLoading(false);

    if (!resp.ok) {
      setMsg((json as { error?: string })?.error ?? "Failed to run AI Pass A.");
      return;
    }

    setMsg(
      `AI Pass A complete. ${(json as { insertedSignals?: number })?.insertedSignals ?? 0} signals added. Recomputing...`
    );

    const recomputeResp = await fetch("/api/assessments/compute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changeEventId }),
    });
    if (!recomputeResp.ok) {
      const j2 = await recomputeResp.json().catch(() => ({}));
      setMsg(
        (j2 as { error?: string })?.error ?? "Recompute failed after Pass A."
      );
      return;
    }

    setMsg("AI Pass A applied and score updated.");
    router.refresh();
  }

  async function submitForReview() {
    setMsg(null);
    setLoading(true);

    const resp = await fetch("/api/changes/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changeEventId }),
    });

    const json = await resp.json().catch(() => ({}));
    setLoading(false);

    if (!resp.ok) {
      setMsg((json as { error?: string })?.error ?? "Failed to submit for review.");
      return;
    }

    if ((json as { alreadySubmitted?: boolean })?.alreadySubmitted) {
      setMsg("Already submitted and in review.");
    } else {
      const due = (json as { due_at?: string })?.due_at
        ? new Date((json as { due_at: string }).due_at).toLocaleString()
        : "—";
      setMsg(
        `Submitted. Bucket: ${(json as { risk_bucket?: string })?.risk_bucket ?? "—"} • Due: ${due}`
      );
    }

    router.refresh();
  }

  return (
    <div className="border rounded p-4 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">Assessment</h2>
          <p className="text-sm opacity-80">
            Status: {assessment?.status ?? "—"} • Score:{" "}
            {assessment?.risk_score_raw ?? "—"}{" "}
            {assessment?.risk_bucket ? `(${assessment.risk_bucket})` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={recompute}
            disabled={loading}
            className="px-3 py-2 rounded bg-black text-white text-sm disabled:opacity-60"
          >
            {loading ? "Working..." : "Recompute"}
          </Button>

          <Button
            onClick={runPassA}
            disabled={loading}
            className="px-3 py-2 rounded border text-sm disabled:opacity-60"
          >
            {loading ? "Working..." : "Run AI Pass A"}
          </Button>

          <Button
            onClick={generateChecklist}
            disabled={loading}
            className="px-3 py-2 rounded border text-sm disabled:opacity-60"
          >
            {loading ? "Working..." : "Generate checklist"}
          </Button>

          <Button
            onClick={submitForReview}
            disabled={loading}
            className="px-3 py-2 rounded border text-sm disabled:opacity-60"
          >
            {loading ? "Working..." : "Submit for review"}
          </Button>
        </div>
      </div>
      {msg && <div className="text-sm border rounded p-2">{msg}</div>}
      {assessment?.pass_a_output?.summary && (
        <div className="border rounded p-3 space-y-2">
          <div className="font-semibold">AI summary</div>
          {assessment.pass_a_output.summary.risk_narrative && (
            <div className="text-sm opacity-90">
              {assessment.pass_a_output.summary.risk_narrative}
            </div>
          )}
          {Array.isArray(assessment.pass_a_output.summary.key_concerns) &&
            assessment.pass_a_output.summary.key_concerns.length > 0 && (
              <ul className="list-disc pl-5 text-sm opacity-80">
                {assessment.pass_a_output.summary.key_concerns
                  .slice(0, 6)
                  .map((c: string, i: number) => (
                    <li key={i}>{c}</li>
                  ))}
              </ul>
            )}
        </div>
      )}
      {/* Top Contributors */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Top contributors</h3>
          <span className="text-xs opacity-60">Top 10</span>
        </div>

        {topContributors.length === 0 ? (
          <p className="text-sm opacity-70">
            No contributing signals yet (score is 0).
          </p>
        ) : (
          <div className="space-y-2">
            {topContributors.map((s) => (
              <div key={s.id} className="border rounded p-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono">{s.signal_key}</span>
                  <span className="text-xs opacity-70">
                    +{s.contribution} (w={s.weight_at_time})
                  </span>
                </div>
                <div className="opacity-80">
                  value:{" "}
                  {s.value_type === "BOOLEAN"
                    ? String(s.value_bool)
                    : String(s.value_num)}{" "}
                  • {prettyCategory(s.category)} • {s.source}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Breakdown by Category */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Signal breakdown</h3>
          <span className="text-xs opacity-60">By category</span>
        </div>

        {breakdown.length === 0 ? (
          <p className="text-sm opacity-70">
            No contributing signals to break down.
          </p>
        ) : (
          <div className="space-y-3">
            {breakdown.map((g) => (
              <div key={g.category} className="border rounded p-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">
                    {prettyCategory(g.category)}
                  </div>
                  <div className="text-sm opacity-80">+{g.total}</div>
                </div>

                <div className="mt-2 space-y-2">
                  {g.items.slice(0, 8).map((s) => (
                    <div
                      key={s.id}
                      className="text-sm flex items-center justify-between gap-3 border rounded p-2"
                    >
                      <span className="font-mono">{s.signal_key}</span>
                      <span className="text-xs opacity-70">
                        +{s.contribution} (w={s.weight_at_time})
                      </span>
                    </div>
                  ))}
                  {g.items.length > 8 && (
                    <div className="text-xs opacity-60">
                      Showing top 8 of {g.items.length} signals in this
                      category.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Mitigation Hints */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Mitigation hints</h3>
          <span className="text-xs opacity-60">Static playbooks (Phase 1)</span>
        </div>

        {breakdown.length === 0 ? (
          <p className="text-sm opacity-70">
            No mitigation hints yet (no contributing signals).
          </p>
        ) : (
          (() => {
            const mitigations = breakdown
              .map((g) => mitigationForCategory(g.category, g.total))
              .filter(
                Boolean
              ) as Array<{
              level: "HIGH" | "VERY_HIGH";
              title: string;
              actions: string[];
            }>;

            if (mitigations.length === 0) {
              return (
                <p className="text-sm opacity-70">
                  No categories exceed mitigation thresholds.
                </p>
              );
            }

            return (
              <div className="space-y-3">
                {mitigations.map((m) => (
                  <div key={m.title} className="border rounded p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{m.title}</div>
                      <div className="text-xs opacity-70">
                        {m.level === "VERY_HIGH"
                          ? "Very high priority"
                          : "High priority"}
                      </div>
                    </div>

                    <ul className="mt-2 list-disc pl-5 space-y-1 text-sm">
                      {m.actions.slice(0, 6).map((a, idx) => (
                        <li key={idx}>{a}</li>
                      ))}
                    </ul>

                    {m.actions.length > 6 && (
                      <div className="text-xs opacity-60 mt-2">
                        Showing 6 of {m.actions.length} actions.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}
