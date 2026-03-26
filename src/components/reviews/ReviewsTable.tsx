"use client";

import { Button, Input, PageHeader, Card, CardBody } from "@/ui";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type View = "my" | "in_review" | "blocked" | "overdue" | "delivery";

type Props = {
  view: View;
  learnedRiskFilter: boolean;
  hasIncidentsFilter: boolean;
};

type Row = {
  changeId: string;
  title: string | null;
  status: string | null;
  domain: string | null;
  submittedAt: string | null;
  dueAt: string | null;
  slaStatus: string | null;
  riskBucket: string | null;
  riskScore: number | null;
  learnedRiskFlag: boolean;
  topLearnedSignals: Array<{
    signalKey: string;
    incidentRate: number;
    totalChanges: number;
    deltaVsBaseline: number;
    contribution: number;
  }>;
  incidentCount: number;
  myPendingApprovalId: string | null;
  pendingApprovalsCount: number;
  missingEvidenceKinds: string[];
  failedDeliveriesCount: number;
  pendingDeliveriesCount: number;
  isOverdue: boolean;
  isEscalated: boolean;
  failedOutboxIds?: string[];
  pendingOutboxIds?: string[];
};

type Counts = {
  my: number;
  in_review: number;
  blocked: number;
  overdue: number;
  delivery: number;
};

type SavedView = {
  id: string;
  name: string;
  query: {
    view?: View;
    learnedRisk?: boolean | number | string;
    hasIncidents?: boolean | number | string;
  };
  is_default: boolean;
};

function fmtPct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString();
}

function learningStatus(eligibleSignals: number) {
  if (eligibleSignals <= 0) return "Early";
  if (eligibleSignals < 10) return "Active";
  return "Mature";
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

/** Gap 2: Business language only — no "queue" or internal terms */
const VIEW_LABELS: Record<View, string> = {
  my: "My approvals",
  in_review: "Needs review",
  blocked: "Awaiting evidence",
  overdue: "Overdue",
  delivery: "Delivery status",
};

export default function ReviewsTable({
  view,
  learnedRiskFilter,
  hasIncidentsFilter,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Counts>({
    my: 0,
    in_review: 0,
    blocked: 0,
    overdue: 0,
    delivery: 0,
  });
  const [baseline, setBaseline] = useState<number>(0);
  const [minSamples, setMinSamples] = useState<number>(20);
  const [eligibleSignals, setEligibleSignals] = useState<number>(0);
  const [lastComputedAt, setLastComputedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [savingView, setSavingView] = useState(false);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelected() {
    setSelected(new Set());
  }

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("view", view);
    if (learnedRiskFilter) sp.set("learnedRisk", "1");
    if (hasIncidentsFilter) sp.set("hasIncidents", "1");
    return `?${sp.toString()}`;
  }, [view, learnedRiskFilter, hasIncidentsFilter]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/reviews/list${query}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load reviews");

      setRows(json.rows || []);
      setCounts(json.counts || { my: 0, in_review: 0, blocked: 0, overdue: 0, delivery: 0 });
      setBaseline(Number(json.baseline ?? 0));
      setMinSamples(Number(json.minSamples ?? 20));
      setEligibleSignals(Number(json.eligibleSignals ?? 0));
      setLastComputedAt(json.lastComputedAt ?? null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [query]);

  useEffect(() => {
    clearSelected();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function loadSavedViews() {
    try {
      const res = await fetch("/api/views/list");
      const json = await res.json().catch(() => ({}));
      if (res.ok) setSavedViews(json.views ?? []);
    } catch {}
  }

  useEffect(() => {
    loadSavedViews();
  }, []);

  function applySavedQuery(q: SavedView["query"]) {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("learnedRisk");
    next.delete("hasIncidents");
    if (q?.view) next.set("view", String(q.view));
    if (q?.learnedRisk) next.set("learnedRisk", "1");
    if (q?.hasIncidents) next.set("hasIncidents", "1");
    const s = next.toString();
    window.location.href = s ? `${pathname}?${s}` : pathname;
  }

  useEffect(() => {
    if (!savedViews.length) return;
    const hasAnyParams = searchParams.toString().length > 0;
    if (hasAnyParams) return;
    const def = savedViews.find((v) => v.is_default);
    if (!def) return;
    applySavedQuery(def.query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedViews]);

  async function saveCurrentView() {
    const name = window.prompt("Saved view name?");
    if (!name) return;
    setSavingView(true);
    try {
      const payload = {
        name,
        query: {
          view,
          learnedRisk: learnedRiskFilter ? 1 : 0,
          hasIncidents: hasIncidentsFilter ? 1 : 0,
        },
      };
      const res = await fetch("/api/views/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Save failed");
      await loadSavedViews();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingView(false);
    }
  }

  const selectedRows = useMemo(() => {
    const s = selected;
    if (!s.size) return [];
    return rows.filter((r) => s.has(r.changeId));
  }, [rows, selected]);

  const selectedFailedOutboxIds = useMemo(() => {
    if (view !== "delivery") return [];
    const ids: string[] = [];
    for (const r of selectedRows) {
      for (const id of r.failedOutboxIds ?? []) ids.push(id);
    }
    return uniq(ids);
  }, [view, selectedRows]);

  const selectedMarkableOutboxIds = useMemo(() => {
    if (view !== "delivery") return [];
    const ids: string[] = [];
    for (const r of selectedRows) {
      for (const id of r.failedOutboxIds ?? []) ids.push(id);
      for (const id of r.pendingOutboxIds ?? []) ids.push(id);
    }
    return uniq(ids);
  }, [view, selectedRows]);

  async function bulkNudge() {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const resp = await fetch("/api/reviews/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "NUDGE_APPROVERS", changeIds: ids }),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      setErr(json?.error ?? "Bulk action failed");
      return;
    }
    clearSelected();
    load();
  }

  async function bulkRetryFailed() {
    if (view !== "delivery") return;
    if (!selectedFailedOutboxIds.length) return;
    const resp = await fetch("/api/reviews/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "RETRY_FAILED",
        outboxIds: selectedFailedOutboxIds,
        changeIds: Array.from(selected),
      }),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      setErr(json?.error ?? "Bulk retry failed");
      return;
    }
    clearSelected();
    load();
  }

  async function bulkMarkDelivered() {
    if (view !== "delivery") return;
    if (!selectedMarkableOutboxIds.length) return;
    const resp = await fetch("/api/reviews/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "MARK_DELIVERED",
        outboxIds: selectedMarkableOutboxIds,
        changeIds: Array.from(selected),
      }),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      setErr(json?.error ?? "Bulk mark delivered failed");
      return;
    }
    clearSelected();
    load();
  }

  async function nudgeOne(changeId: string) {
    setErr(null);
    const resp = await fetch("/api/reviews/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "NUDGE_APPROVERS",
        changeIds: [changeId],
      }),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) setErr(json?.error ?? "Nudge failed");
    else load();
  }

  async function retryFailedOne(outboxIds: string[], changeId: string) {
    if (!outboxIds.length) return;
    setErr(null);
    const resp = await fetch("/api/reviews/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "RETRY_FAILED",
        outboxIds,
        changeIds: [changeId],
      }),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) setErr(json?.error ?? "Retry failed");
    else load();
  }

  const setViewLink = useMemo(
    () => (v: View) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set("view", v);
      return `${pathname}?${next.toString()}`;
    },
    [pathname, searchParams]
  );

  const toggleParam = useMemo(
    () => (key: string, active: boolean) => {
      const next = new URLSearchParams(searchParams.toString());
      if (active) next.delete(key);
      else next.set(key, "1");
      const q = next.toString();
      return q ? `${pathname}?${q}` : pathname;
    },
    [pathname, searchParams]
  );

  return (
    <div data-testid={`reviews-table-${view}`} className="space-y-4">
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/home" },
          { label: "Changes" },
        ]}
        title="Changes"
        description="Revenue-impacting changes in flight. Track review status, missing details, deadlines, and what needs action next."
        right={
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link
              href="/changes/new"
              className="inline-flex h-9 items-center justify-center rounded-md bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-contrast)] shadow-sm transition-colors hover:opacity-90"
            >
              Declare Revenue Change
            </Link>
            {(Object.keys(VIEW_LABELS) as View[]).map((v) => (
              <Link
                key={v}
                href={setViewLink(v)}
                className={`text-sm px-2 py-1 rounded border ${
                  view === v ? "bg-black/10 font-medium" : ""
                }`}
              >
                {VIEW_LABELS[v]}
                {counts[v] != null && counts[v] > 0 && (
                  <span className="ml-1 opacity-70">({counts[v]})</span>
                )}
              </Link>
            ))}
            <FilterLink
              label="Learned risk"
              active={learnedRiskFilter}
              href={toggleParam("learnedRisk", learnedRiskFilter)}
            />
            <FilterLink
              label="Has incidents"
              active={hasIncidentsFilter}
              href={toggleParam("hasIncidents", hasIncidentsFilter)}
            />
            <Button
              type="button"
              className="text-sm underline opacity-70"
              onClick={load}
            >
              Refresh
            </Button>
            <div className="relative">
              <details className="inline-block">
                <summary className="text-sm px-2 py-1 rounded border cursor-pointer select-none">
                  Saved views
                </summary>
                <div className="absolute right-0 z-10 mt-2 w-64 rounded-[var(--radius-sb)] border border-[var(--border)] bg-[var(--bg-surface)] p-2 shadow-lg">
                  <div className="text-xs font-semibold opacity-70 mb-2">
                    Apply
                  </div>
                  {savedViews.length === 0 ? (
                    <div className="text-sm opacity-70 p-2">
                      No saved views yet.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {savedViews.map((sv) => (
                        <div
                          key={sv.id}
                          className="flex items-center justify-between gap-2"
                        >
                          <Button
                            type="button"
                            className="text-sm underline text-left flex-1"
                            onClick={() => applySavedQuery(sv.query)}
                          >
                            {sv.name}
                            {sv.is_default ? " ★" : ""}
                          </Button>
                          <Button
                            type="button"
                            className="text-xs underline opacity-70"
                            onClick={async () => {
                              await fetch("/api/views/set-default", {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                },
                                body: JSON.stringify({ id: sv.id }),
                              });
                              await loadSavedViews();
                            }}
                          >
                            Default
                          </Button>
                          <Button
                            type="button"
                            className="text-xs underline opacity-70"
                            onClick={async () => {
                              await fetch("/api/views/delete", {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                },
                                body: JSON.stringify({ id: sv.id }),
                              });
                              await loadSavedViews();
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="border-t my-2" />
                  <Button
                    type="button"
                    className="text-sm underline"
                    onClick={saveCurrentView}
                    disabled={savingView}
                  >
                    {savingView ? "Saving…" : "Save current view…"}
                  </Button>
                </div>
              </details>
            </div>
          </div>
        }
      />

      {loading && <p className="text-sm text-[var(--text-muted)]">Loading…</p>}
      {err && <p className="text-sm text-[var(--danger)]">{err}</p>}

      {!loading && !err && selected.size > 0 && (
        <Card>
          <CardBody className="flex flex-row flex-wrap items-center justify-between gap-2 py-3">
            <div className="text-sm">
              <span className="font-medium">{selected.size}</span> selected
              <Button
                type="button"
                className="ml-3 text-xs underline opacity-70"
                onClick={clearSelected}
              >
                Clear
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="px-3 py-1.5 rounded border text-sm disabled:opacity-50"
                onClick={bulkNudge}
              >
                Nudge approvers
              </Button>
              {view === "delivery" && (
                <>
                  <Button
                    type="button"
                    className="px-3 py-1.5 rounded border text-sm disabled:opacity-50"
                    onClick={bulkRetryFailed}
                    disabled={selectedFailedOutboxIds.length === 0}
                    title={
                      selectedFailedOutboxIds.length === 0
                        ? "No failed deliveries in selection"
                        : "Retry failed deliveries"
                    }
                  >
                    Retry failed
                  </Button>
                  <Button
                    type="button"
                    className="px-3 py-1.5 rounded border text-sm disabled:opacity-50"
                    onClick={bulkMarkDelivered}
                    disabled={selectedMarkableOutboxIds.length === 0}
                    title={
                      selectedMarkableOutboxIds.length === 0
                        ? "No pending/failed deliveries in selection"
                        : "Mark pending/failed deliveries as SENT"
                    }
                  >
                    Mark delivered
                  </Button>
                </>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {!loading && !err && rows.length > 0 &&
          (() => {
            const overdueCount = rows.filter((r) => r.isOverdue).length;
            const escalatedCount = rows.filter((r) => r.isEscalated).length;
            if (overdueCount === 0 && escalatedCount === 0) return null;
            return (
                <div
                className={`rounded-[var(--radius-sb)] border px-3 py-2 text-sm flex flex-wrap items-center justify-between gap-2 ${
                  escalatedCount > 0
                    ? "border-[var(--danger)]/50 bg-[color-mix(in_oklab,var(--danger)_12%,var(--bg-surface))]"
                    : "border-[var(--warning)]/50 bg-[color-mix(in_oklab,var(--warning)_12%,var(--bg-surface))]"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  {escalatedCount > 0 && (
                    <span className="font-medium">{escalatedCount} escalated</span>
                  )}
                  {overdueCount > 0 && (
                    <span
                      className={
                        escalatedCount > 0 ? "opacity-80" : "font-medium"
                      }
                    >
                      {overdueCount} overdue
                    </span>
                  )}
                </div>
                <div className="text-xs opacity-70">
                  Escalated and overdue items should be handled first.
                </div>
              </div>
            );
          })()}

      {!loading && !err && (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-12 gap-2 border-b border-[var(--border)] p-[var(--card-spacer-x)] text-xs font-semibold">
              <div className="col-span-1">
                <Input
                  type="checkbox"
                  checked={rows.length > 0 && selected.size === rows.length}
                  onChange={(e) => {
                    if (e.target.checked)
                      setSelected(new Set(rows.map((r) => r.changeId)));
                    else clearSelected();
                  }}
                  aria-label="Select all"
                />
              </div>
              <div className="col-span-4">Change</div>
              <div className="col-span-2">Risk</div>
              <div className="col-span-3">Learning</div>
              <div className="col-span-2">Incidents</div>
            </div>

            {rows.map((r) => (
              <Link
                key={r.changeId}
                href={`/changes/${r.changeId}`}
                className="grid grid-cols-12 gap-2 border-b border-[var(--border)] p-[var(--card-spacer-x)] text-sm last:border-b-0 hover:bg-[color-mix(in_oklab,var(--bg-surface)_92%,var(--primary)_8%)]"
              >
                <div
                  className="col-span-1"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <Input
                    type="checkbox"
                    checked={selected.has(r.changeId)}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onChange={() => toggleSelected(r.changeId)}
                    aria-label={`Select ${r.title || r.changeId}`}
                  />
                </div>
                <div className="col-span-4">
                  <div className="font-medium">{r.title || "(untitled change)"}</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    <Link
                      href={`/changes/${r.changeId}#checklist`}
                      onClick={(e) => e.stopPropagation()}
                      className="underline opacity-70"
                    >
                      Open checklist
                    </Link>
                    <Link
                      href={`/changes/${r.changeId}#evidence-panel`}
                      onClick={(e) => e.stopPropagation()}
                      className="underline opacity-70"
                    >
                      Add evidence
                    </Link>
                    {(view === "my" ||
                      view === "in_review" ||
                      view === "overdue") && (
                      <Button
                        type="button"
                        className="underline opacity-70"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          nudgeOne(r.changeId);
                        }}
                        title="Send a nudge to approvers"
                      >
                        Nudge
                      </Button>
                    )}
                    {view === "delivery" &&
                      (r.failedOutboxIds?.length ?? 0) > 0 && (
                        <Button
                          type="button"
                          className="underline opacity-70"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            retryFailedOne(
                              r.failedOutboxIds ?? [],
                              r.changeId
                            );
                          }}
                          title="Retry failed deliveries for this change"
                        >
                          Retry failed
                        </Button>
                      )}
                  </div>
                  <div className="text-xs opacity-70 flex flex-wrap items-center gap-x-2 gap-y-1">
                    {r.submittedAt ? fmtDate(r.submittedAt) : "—"} • {r.status || "—"}
                    {r.domain && (
                      <>
                        {" • "}
                        <Badge tone="neutral">{r.domain}</Badge>
                      </>
                    )}
                    {r.dueAt && (
                      <>
                        {" • "}
                        Due {fmtDate(r.dueAt)}
                      </>
                    )}
                    {r.slaStatus && (
                      <>
                        {" • "}
                        <Badge tone="danger">{r.slaStatus}</Badge>
                      </>
                    )}
                    {r.isEscalated && <Badge tone="danger">Escalated</Badge>}
                    {r.isOverdue && <Badge tone="danger">Overdue</Badge>}
                    {r.missingEvidenceKinds?.length > 0 && (
                      <Badge tone="warn">Blocked</Badge>
                    )}
                    {r.myPendingApprovalId && (
                      <Badge tone="info">Needs you</Badge>
                    )}
                    {view === "delivery" ? (
                      <>
                        {r.failedDeliveriesCount > 0 && (
                          <Badge tone="danger">{r.failedDeliveriesCount} failed</Badge>
                        )}
                        {r.pendingDeliveriesCount > 0 && (
                          <Badge tone="neutral">{r.pendingDeliveriesCount} pending</Badge>
                        )}
                      </>
                    ) : (
                      r.failedDeliveriesCount > 0 && (
                        <Badge tone="danger">Delivery</Badge>
                      )
                    )}
                  </div>
                </div>

                <div className="col-span-2">
                  <div className="inline-flex items-center gap-2">
                    <Badge tone="neutral">{r.riskBucket || "—"}</Badge>
                    {r.riskScore != null && (
                      <span className="text-xs opacity-70">{Math.round(r.riskScore)}</span>
                    )}
                  </div>
                </div>

                <div className="col-span-3">
                  {r.learnedRiskFlag ? (
                    <div className="space-y-1">
                      <Badge tone="warn">Learned risk</Badge>
                      {r.topLearnedSignals.slice(0, 2).map((s) => (
                        <div key={s.signalKey} className="text-xs opacity-80 font-mono">
                          {s.signalKey} • {fmtPct(s.incidentRate)} (n={s.totalChanges}) • Δ{" "}
                          {s.deltaVsBaseline >= 0 ? "+" : ""}
                          {fmtPct(s.deltaVsBaseline)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs opacity-60">No strong learned signals</div>
                  )}
                </div>

                <div className="col-span-2">
                  {r.incidentCount > 0 ? (
                    <Badge tone="danger">{r.incidentCount} linked</Badge>
                  ) : (
                    <span className="text-xs opacity-60">0</span>
                  )}
                </div>
              </Link>
            ))}

            {rows.length === 0 && (
              <div className="p-[var(--card-spacer-x)] text-center">
                <p className="text-sm text-[var(--text-muted)]">
                  No changes yet.
                </p>
                <p className="mt-1 text-sm text-[var(--text)]">
                  Start by connecting Jira or creating your first revenue change.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href="/changes/new"
                    className="inline-flex h-10 items-center justify-center rounded-md bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-contrast)] hover:opacity-90"
                  >
                    Create revenue change
                  </Link>
                  <Link
                    href="/dashboard"
                    className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--border)] px-4 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-surface-2)]"
                  >
                    Go to overview
                  </Link>
                </div>
              </div>
            )}
        </Card>
      )}
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "neutral" | "warn" | "danger" | "info";
}) {
  const cls =
    tone === "neutral"
      ? "bg-black/5"
      : tone === "warn"
        ? "bg-yellow-200/60"
        : tone === "danger"
          ? "bg-red-200/60"
          : "bg-blue-200/60";
  return <span className={`px-2 py-1 rounded text-xs ${cls}`}>{children}</span>;
}

function FilterLink({
  label,
  active,
  href,
}: {
  label: string;
  active: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`text-sm px-2 py-1 rounded border ${active ? "bg-black/5" : ""}`}
    >
      {label}
    </Link>
  );
}
