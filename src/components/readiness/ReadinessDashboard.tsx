"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardBody,
  EmptyState,
  Grid,
  PageHeaderV2,
  SectionHeader,
  Stack,
} from "@/ui";

type PortfolioRow = {
  readiness_score?: number;
  readiness_level?: string;
  calculated_at?: string;
} | null;

type ScoreRow = {
  scope_id: string;
  readiness_score: number;
  readiness_level: string;
};

type PredRow = {
  id: string;
  change_event_id: string;
  prediction_type: string;
  confidence_score: number;
  explanation_json?: { headline?: string; bullets?: string[] };
};

type ReadinessApi = {
  portfolio: PortfolioRow;
  topReleases: ScoreRow[];
  topAtRiskChanges: ScoreRow[];
  activePredictions: PredRow[];
  trend: Array<{ readiness_score: number; captured_at: string }>;
};

function levelTone(level: string | undefined) {
  const l = (level ?? "").toUpperCase();
  if (l === "NOT_READY") return "text-[var(--danger)]";
  if (l === "AT_RISK") return "text-amber-600 dark:text-amber-400";
  if (l === "WATCH") return "text-amber-700 dark:text-amber-300";
  if (l === "READY") return "text-[var(--success)]";
  return "text-[var(--text-muted)]";
}

export function ReadinessDashboard({ orgId }: { orgId: string }) {
  const [data, setData] = useState<ReadinessApi | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/readiness?orgId=${encodeURIComponent(orgId)}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? res.statusText);
      }
      const j = (await res.json()) as ReadinessApi;
      setData(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load readiness");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const port = data?.portfolio;

  return (
    <Stack gap={6} className="flex flex-col pb-10">
      <PageHeaderV2
        title="Release readiness"
        description="Portfolio and change-level readiness scores, plus active predicted risks (Phase 5)."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className="text-sm font-medium text-[var(--primary)] hover:underline disabled:opacity-50"
            disabled={loading}
          >
            Refresh
          </button>
        }
      />

      {err && (
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--danger)]">{err}</p>
          </CardBody>
        </Card>
      )}

      {loading && !data ? (
        <p className="text-sm text-[var(--text-muted)]">Loading…</p>
      ) : null}

      {data && (
        <>
          <Grid cols={1} gap={4} className="md:grid-cols-3">
            <Card>
              <CardBody>
                <Stack gap={1}>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                    Portfolio (14d)
                  </p>
                  <p className={`text-3xl font-semibold tabular-nums ${levelTone(port?.readiness_level)}`}>
                    {port?.readiness_score != null ? port.readiness_score : "—"}
                  </p>
                  <p className={`text-sm font-medium ${levelTone(port?.readiness_level)}`}>
                    {port?.readiness_level ?? "—"}
                  </p>
                  {port?.calculated_at ? (
                    <p className="text-xs text-[var(--text-muted)]">
                      Updated {new Date(port.calculated_at).toLocaleString()}
                    </p>
                  ) : null}
                </Stack>
              </CardBody>
            </Card>
            <Card className="md:col-span-2">
              <CardBody>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)] mb-2">
                  30-day trend (portfolio)
                </p>
                {data.trend && data.trend.length > 1 ? (
                  <div className="flex h-16 items-end gap-px">
                    {data.trend.slice(-40).map((pt, i) => {
                      const h = Math.max(4, Math.round((pt.readiness_score / 100) * 56));
                      return (
                        <div
                          key={`${pt.captured_at}-${i}`}
                          className="min-w-[3px] flex-1 rounded-sm bg-[var(--primary)]/70"
                          style={{ height: `${h}px` }}
                          title={`${pt.readiness_score} @ ${new Date(pt.captured_at).toLocaleDateString()}`}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-muted)]">
                    Trend appears after scheduled snapshot runs.
                  </p>
                )}
              </CardBody>
            </Card>
          </Grid>

          <SectionHeader title="Releases (lowest scores first)" />
          {data.topReleases.length === 0 ? (
            <EmptyState
              variant="still_building"
              title="No release scores yet"
              body="Assign changes to releases and run readiness recompute."
            />
          ) : (
            <Stack gap={2}>
              {data.topReleases.map((r) => (
                <Card key={r.scope_id}>
                  <CardBody className="flex flex-row flex-wrap items-center justify-between gap-3">
                    <div>
                      <Link
                        href={`/readiness/release/${r.scope_id}`}
                        className="text-sm font-medium text-[var(--primary)] hover:underline"
                      >
                        Release {r.scope_id.slice(0, 8)}…
                      </Link>
                      <p className={`text-xs ${levelTone(r.readiness_level)}`}>{r.readiness_level}</p>
                    </div>
                    <p className="text-xl font-semibold tabular-nums">{r.readiness_score}</p>
                  </CardBody>
                </Card>
              ))}
            </Stack>
          )}

          <SectionHeader title="Changes (lowest scores first)" />
          {data.topAtRiskChanges.length === 0 ? (
            <EmptyState
              variant="still_building"
              title="No change scores yet"
              body="Scores are computed for active changes in the portfolio window."
            />
          ) : (
            <Stack gap={2}>
              {data.topAtRiskChanges.map((c) => (
                <Card key={c.scope_id}>
                  <CardBody className="flex flex-row flex-wrap items-center justify-between gap-3">
                    <div>
                      <Link
                        href={`/changes/${c.scope_id}`}
                        className="text-sm font-medium text-[var(--primary)] hover:underline"
                      >
                        Change {c.scope_id.slice(0, 8)}…
                      </Link>
                      <p className={`text-xs ${levelTone(c.readiness_level)}`}>{c.readiness_level}</p>
                    </div>
                    <p className="text-xl font-semibold tabular-nums">{c.readiness_score}</p>
                  </CardBody>
                </Card>
              ))}
            </Stack>
          )}

          <SectionHeader title="Active predictions" />
          {data.activePredictions.length === 0 ? (
            <EmptyState
              variant="good_empty"
              title="No active predictions"
              body="Enable predictive warnings in org settings to generate risk rows."
            />
          ) : (
            <Stack gap={3}>
              {data.activePredictions.map((p) => (
                <Card key={p.id}>
                  <CardBody className="space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">
                          {p.explanation_json?.headline ?? p.prediction_type.replace(/_/g, " ")}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {p.prediction_type.replace(/_/g, " ")} · {p.confidence_score}% confidence
                        </p>
                      </div>
                      <Link
                        href={`/changes/${p.change_event_id}`}
                        className="text-xs font-medium text-[var(--primary)] hover:underline"
                      >
                        Open change
                      </Link>
                    </div>
                    {p.explanation_json?.bullets && p.explanation_json.bullets.length > 0 ? (
                      <ul className="list-disc pl-5 text-sm text-[var(--text-muted)]">
                        {p.explanation_json.bullets.slice(0, 5).map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    ) : null}
                  </CardBody>
                </Card>
              ))}
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
}
