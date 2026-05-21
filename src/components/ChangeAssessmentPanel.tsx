"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/ui";
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
    const map = new Map<string, { category: string; total: number; items: SignalRow[] }>();

    for (const s of contributingSignals) {
      const cat = s.category ?? "UNKNOWN";
      const entry = map.get(cat) ?? { category: cat, total: 0, items: [] };
      entry.total += s.contribution ?? 0;
      entry.items.push(s);
      map.set(cat, entry);
    }

    const groups = Array.from(map.values()).map((g) => ({
      ...g,
      items: [...g.items].sort((a, b) => (b.contribution - 0) - (a.contribution - 0)),
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
      setMsg(json?.error ?? "Assessment could not be refreshed.");
      return;
    }

    setMsg("Assessment refreshed.");
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
      setMsg(json?.error ?? "Checklist could not be generated.");
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
      setMsg((json as { error?: string })?.error ?? "AI review could not be refreshed.");
      return;
    }

    setMsg(`AI review refreshed. ${(json as { insertedSignals?: number })?.insertedSignals ?? 0} review factors updated.`);

    const recomputeResp = await fetch("/api/assessments/compute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changeEventId }),
    });
    if (!recomputeResp.ok) {
      const j2 = await recomputeResp.json().catch(() => ({}));
      setMsg((j2 as { error?: string })?.error ?? "Assessment refresh failed after AI review.");
      return;
    }

    setMsg("AI review applied and assessment updated.");
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
      setMsg((json as { error?: string })?.error ?? "Could not submit this change for review.");
      return;
    }

    if ((json as { alreadySubmitted?: boolean })?.alreadySubmitted) {
      setMsg("Already submitted and in review.");
    } else {
      const due = (json as { due_at?: string })?.due_at
        ? new Date((json as { due_at: string }).due_at).toLocaleString()
        : "-";
      setMsg(`Submitted. Review level: ${(json as { risk_bucket?: string })?.risk_bucket ?? "-"} - Due: ${due}`);
    }

    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Reviewer insight</CardTitle>
          <CardDescription>
            Status: {assessment?.status ?? "-"} - Review level: {assessment?.risk_bucket ?? "Not assessed"}
          </CardDescription>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={recompute} disabled={loading}>
            {loading ? "Working..." : "Refresh insight"}
          </Button>
          <Button onClick={runPassA} disabled={loading} variant="secondary">
            {loading ? "Working..." : "Refresh review"}
          </Button>
          <Button onClick={generateChecklist} disabled={loading} variant="secondary">
            {loading ? "Working..." : "Generate proof list"}
          </Button>
          <Button onClick={submitForReview} disabled={loading} variant="secondary">
            {loading ? "Working..." : "Submit for review"}
          </Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">

      {msg && <div className="rounded-[var(--radius-md)] border border-[var(--border)] p-2 text-sm">{msg}</div>}

      {assessment?.pass_a_output?.summary && (
        <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--border)] p-3">
          <div className="font-semibold">Reviewer summary</div>
          {assessment.pass_a_output.summary.risk_narrative && (
            <div className="text-sm text-[var(--text)]">{assessment.pass_a_output.summary.risk_narrative}</div>
          )}
          {Array.isArray(assessment.pass_a_output.summary.key_concerns) &&
            assessment.pass_a_output.summary.key_concerns.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--text-muted)]">
                {assessment.pass_a_output.summary.key_concerns.slice(0, 6).map((c: string, i: number) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            )}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Why this needs attention</h3>
          <span className="text-xs text-[var(--text-muted)]">Top factors</span>
        </div>

        {topContributors.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No review factors have increased the assessment yet.</p>
        ) : (
          <div className="space-y-2">
            {topContributors.map((s) => (
              <div key={s.id} className="rounded-[var(--radius-md)] border border-[var(--border)] p-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{prettyCategory(s.category)}</span>
                  <span className="text-xs text-[var(--text-muted)]">Impact +{s.contribution}</span>
                </div>
                <div className="text-[var(--text-muted)]">
                  Observed value: {s.value_type === "BOOLEAN" ? String(s.value_bool) : String(s.value_num)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <details className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-3">
        <summary className="cursor-pointer font-semibold">Detailed factor breakdown</summary>
        <div className="mt-3 space-y-3">
          {breakdown.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No contributing factors to break down.</p>
          ) : (
            breakdown.map((g) => (
              <div key={g.category} className="rounded-[var(--radius-md)] border border-[var(--border)] p-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{prettyCategory(g.category)}</div>
                  <div className="text-sm text-[var(--text-muted)]">+{g.total}</div>
                </div>
                <div className="mt-2 space-y-2">
                  {g.items.slice(0, 8).map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] p-2 text-sm"
                    >
                      <span className="font-mono">{s.signal_key}</span>
                      <span className="text-xs text-[var(--text-muted)]">
                        +{s.contribution} (w={s.weight_at_time})
                      </span>
                    </div>
                  ))}
                  {g.items.length > 8 && (
                    <div className="text-xs text-[var(--text-muted)]">
                      Showing top 8 of {g.items.length} factors in this category.
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </details>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Suggested safeguards</h3>
          <span className="text-xs text-[var(--text-muted)]">Recommended actions</span>
        </div>

        {breakdown.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            No safeguards are suggested yet because no review factors have increased the assessment.
          </p>
        ) : (
          (() => {
            const mitigations = breakdown
              .map((g) => mitigationForCategory(g.category, g.total))
              .filter(Boolean) as Array<{
              level: "HIGH" | "VERY_HIGH";
              title: string;
              actions: string[];
            }>;

            if (mitigations.length === 0) {
              return <p className="text-sm text-[var(--text-muted)]">No categories exceed safeguard thresholds.</p>;
            }

            return (
              <div className="space-y-3">
                {mitigations.map((m) => (
                  <div key={m.title} className="rounded-[var(--radius-md)] border border-[var(--border)] p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{m.title}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {m.level === "VERY_HIGH" ? "Very high priority" : "High priority"}
                      </div>
                    </div>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                      {m.actions.slice(0, 6).map((a, idx) => (
                        <li key={idx}>{a}</li>
                      ))}
                    </ul>
                    {m.actions.length > 6 && (
                      <div className="mt-2 text-xs text-[var(--text-muted)]">
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
      </CardBody>
    </Card>
  );
}
