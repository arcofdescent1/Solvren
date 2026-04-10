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
import { ValueStoryCard } from "@/components/outcomes/ValueStoryCard";

type TopStory = {
  id: string;
  headline: string;
  outcome_type: string;
  estimated_value: number | null;
  confidence_level: string;
  status: string;
  finalized_at?: string | null;
};

type OutcomesSummary = {
  disabled?: boolean;
  revenueProtectedMonth: number;
  revenueProtectedQuarter: number;
  incidentsPreventedMonth: number;
  approvalHoursSavedMonth: number;
  readinessGainedMonth: number;
  topStories: TopStory[];
};

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function ExecutiveOutcomesDashboard({ orgId }: { orgId: string }) {
  const [data, setData] = useState<OutcomesSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/outcomes?orgId=${encodeURIComponent(orgId)}`, { credentials: "include" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? res.statusText);
      }
      setData((await res.json()) as OutcomesSummary);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load outcomes");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Stack gap={6} className="flex flex-col pb-10">
      <PageHeaderV2
        title="Executive outcomes"
        description="Revenue protected, incidents avoided, and value stories backed by evidence (Phase 6)."
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

      {loading && !data ? <p className="text-sm text-[var(--text-muted)]">Loading…</p> : null}

      {data?.disabled ? (
        <EmptyState
          variant="incomplete_setup"
          title="Value tracking is off"
          body="Enable value tracking in organization settings to create stories and metrics."
        />
      ) : null}

      {data && !data.disabled ? (
        <>
          <p className="text-xs text-[var(--text-muted)]">
            Revenue figures use estimated monthly revenue at risk recorded on each change (default one-month basis), then Phase 6
            prevention confidence and duration factors.
          </p>
          <Grid cols={1} gap={4} className="sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardBody>
                <p className="text-xs font-medium uppercase text-[var(--text-muted)]">Revenue protected (MTD)</p>
                <p className="text-2xl font-semibold tabular-nums">{fmtMoney(data.revenueProtectedMonth)}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-xs font-medium uppercase text-[var(--text-muted)]">Revenue protected (QTD)</p>
                <p className="text-2xl font-semibold tabular-nums">{fmtMoney(data.revenueProtectedQuarter)}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-xs font-medium uppercase text-[var(--text-muted)]">Incidents prevented (MTD)</p>
                <p className="text-2xl font-semibold tabular-nums">{data.incidentsPreventedMonth}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-xs font-medium uppercase text-[var(--text-muted)]">Approval hrs saved (MTD)</p>
                <p className="text-2xl font-semibold tabular-nums">{data.approvalHoursSavedMonth}</p>
              </CardBody>
            </Card>
          </Grid>
          <Card>
            <CardBody>
              <p className="text-xs font-medium uppercase text-[var(--text-muted)]">Readiness gain (MTD avg)</p>
              <p className="text-2xl font-semibold tabular-nums">{data.readinessGainedMonth.toFixed(1)} pts</p>
            </CardBody>
          </Card>

          <SectionHeader
            title="Top value stories"
            action={
              <Link href="/outcomes/value-stories" className="text-sm text-[var(--primary)] hover:underline">
                View all
              </Link>
            }
          />
          {data.topStories.length === 0 ? (
            <EmptyState
              variant="still_building"
              title="No finalized stories yet"
              body="Run the outcomes process job after predictions resolve and observation windows complete."
            />
          ) : (
            <Stack gap={3}>
              {data.topStories.map((s) => (
                <ValueStoryCard key={s.id} story={s} />
              ))}
            </Stack>
          )}
        </>
      ) : null}
    </Stack>
  );
}
