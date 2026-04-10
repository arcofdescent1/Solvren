"use client";

import {
  Button,
  Card,
  CardBody,
  EmptyState,
  Input,
  PageHeaderV2,
  SectionHeader,
  StatusBadge,
  TableShell,
} from "@/ui";
import { trackAppEvent } from "@/lib/appAnalytics";
import { HELP_COPY } from "@/config/helpCopy";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  MetricHelpTooltip,
  PageHelpDrawer,
  SectionHelp,
  StatusHelpTooltip,
  WhatHappensNextCallout,
  WhySurfacedText,
} from "@/components/help";

type CanonicalView = "all" | "needs-review" | "needs-details" | "overdue" | "delivery-health";
type View = CanonicalView | "my" | "in_review" | "blocked" | "delivery" | "needs-my-review";

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
  createdBy: string | null;
  submittedAt: string | null;
  dueAt: string | null;
  slaStatus: string | null;
  riskBucket: string | null;
  riskScore: number | null;
  learnedRiskFlag: boolean;
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
    view?: string;
    learnedRisk?: boolean | number | string;
    hasIncidents?: boolean | number | string;
  };
  is_default: boolean;
};

type BulkAction = "NUDGE_APPROVERS" | "RETRY_FAILED" | "MARK_DELIVERED";

const SEGMENTS: Array<{ key: CanonicalView; label: string }> = [
  { key: "all", label: "All changes" },
  { key: "needs-review", label: "Needs my review" },
  { key: "needs-details", label: "Needs details" },
  { key: "overdue", label: "Overdue" },
  { key: "delivery-health", label: "Delivery health" },
];

const LEGACY_VIEW_NAME_MAP: Record<string, string> = {
  "My approvals": "Needs my review",
  "Awaiting evidence": "Needs details",
  "Delivery status": "Delivery health",
};

function fmtDate(value: string | null) {
  if (!value) return "No due date";
  return new Date(value).toLocaleDateString();
}

function withQuery(pathname: string, current: { toString(): string }, patch: Record<string, string | null>) {
  const next = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(patch)) {
    if (value == null || value === "") next.delete(key);
    else next.set(key, value);
  }
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function getOwnerLabel(row: Row, currentUserId: string | null) {
  if (!row.createdBy) return "Unassigned";
  if (currentUserId && row.createdBy === currentUserId) return "You";
  return "Creator";
}

function isHighImpact(row: Row) {
  const bucket = (row.riskBucket ?? "").toUpperCase();
  return bucket === "HIGH" || bucket === "CRITICAL";
}

function needsDetails(row: Row) {
  return (
    row.missingEvidenceKinds.length > 0 ||
    (row.status ?? "") === "DRAFT" ||
    ((row.status ?? "") === "IN_REVIEW" && row.pendingApprovalsCount === 0)
  );
}

function getNextStep(row: Row) {
  if (row.myPendingApprovalId) return "Review approvals";
  if (needsDetails(row)) return "Add supporting details";
  if (row.failedDeliveriesCount > 0) return "Retry notifications";
  if (row.incidentCount > 0) return "View linked issue";
  if (row.pendingApprovalsCount > 0) return "Wait for approver";
  return row.status === "APPROVED" ? "No action needed" : "Monitoring";
}

function getStatusLabel(row: Row) {
  if (row.myPendingApprovalId) return "Needs your review";
  if (needsDetails(row)) return "Needs details";
  if (row.failedDeliveriesCount > 0) return "Delivery failed";
  if (row.pendingDeliveriesCount > 0) return "Delivery pending";
  if (row.isOverdue || row.isEscalated) return "Overdue";
  return "In progress";
}

export default function ReviewsTable({ view, learnedRiskFilter, hasIncidentsFilter }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Counts>({
    my: 0,
    in_review: 0,
    blocked: 0,
    overdue: 0,
    delivery: 0,
  });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState(searchParams.get("q") ?? "");
  const [domainFilter, setDomainFilter] = useState(searchParams.get("domain") ?? "");
  const [impactFilter, setImpactFilter] = useState(searchParams.get("impact") ?? "");
  const [ownerFilter, setOwnerFilter] = useState(searchParams.get("owner") ?? "");
  const [sourceModeFilter, setSourceModeFilter] = useState(searchParams.get("sourceMode") ?? "");

  const sourceModeFromUrl = searchParams.get("sourceMode") ?? "";
  useEffect(() => {
    setSourceModeFilter(sourceModeFromUrl);
  }, [sourceModeFromUrl]);

  const resolvedView: CanonicalView =
    view === "my" || view === "needs-my-review"
      ? "needs-review"
      : view === "in_review"
      ? "all"
      : view === "blocked"
      ? "needs-details"
      : view === "delivery"
      ? "delivery-health"
      : view;

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("view", resolvedView);
    if (learnedRiskFilter) sp.set("learnedRisk", "1");
    if (hasIncidentsFilter) sp.set("hasIncidents", "1");
    if (sourceModeFilter.trim()) sp.set("sourceMode", sourceModeFilter.trim());
    return `?${sp.toString()}`;
  }, [resolvedView, learnedRiskFilter, hasIncidentsFilter, sourceModeFilter]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const [reviewsRes, userRes] = await Promise.all([
          fetch(`/api/reviews/list${query}`),
          fetch("/api/auth/me"),
        ]);
        const reviewsJson = await reviewsRes.json();
        if (!reviewsRes.ok) throw new Error(reviewsJson?.error || "Failed to load changes");
        const userJson = await userRes.json().catch(() => ({}));
        setRows(reviewsJson.rows ?? []);
        setCounts(reviewsJson.counts ?? { my: 0, in_review: 0, blocked: 0, overdue: 0, delivery: 0 });
        setCurrentUserId(userJson?.user?.id ?? null);
        trackAppEvent("changes_page_view", {
          view: resolvedView,
          row_count: reviewsJson.rows?.length ?? 0,
        });
      } catch (error) {
        setErr(error instanceof Error ? error.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [query, resolvedView]);

  useEffect(() => {
    setSelected(new Set());
    setActiveRowId(null);
  }, [query]);

  useEffect(() => {
    async function loadSavedViews() {
      try {
        const res = await fetch("/api/views/list");
        const json = await res.json().catch(() => ({}));
        if (res.ok) setSavedViews(json.views ?? []);
      } catch {}
    }
    void loadSavedViews();
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (searchText) {
        const q = searchText.toLowerCase();
        const matches =
          (row.title ?? "").toLowerCase().includes(q) ||
          row.changeId.toLowerCase().includes(q) ||
          (row.domain ?? "").toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (domainFilter && (row.domain ?? "").toLowerCase() !== domainFilter.toLowerCase()) return false;
      if (impactFilter === "high" && !isHighImpact(row)) return false;
      if (ownerFilter === "me" && getOwnerLabel(row, currentUserId) !== "You") return false;
      if (ownerFilter === "unassigned" && getOwnerLabel(row, currentUserId) !== "Unassigned") return false;
      if (resolvedView === "needs-details" && !needsDetails(row)) return false;
      if (resolvedView === "delivery-health" && row.failedDeliveriesCount + row.pendingDeliveriesCount === 0) return false;
      return true;
    });
  }, [rows, searchText, domainFilter, impactFilter, ownerFilter, currentUserId, resolvedView]);

  const selectedRows = useMemo(() => filteredRows.filter((row) => selected.has(row.changeId)), [filteredRows, selected]);
  const activeRow = useMemo(
    () => filteredRows.find((row) => row.changeId === activeRowId) ?? null,
    [filteredRows, activeRowId]
  );
  const selectedFailedOutboxIds = useMemo(
    () => selectedRows.flatMap((row) => row.failedOutboxIds ?? []),
    [selectedRows]
  );
  const selectedMarkableOutboxIds = useMemo(
    () => selectedRows.flatMap((row) => [...(row.failedOutboxIds ?? []), ...(row.pendingOutboxIds ?? [])]),
    [selectedRows]
  );

  const recommended = useMemo(() => {
    return [...filteredRows]
      .sort((a, b) => {
        const aWeight =
          (a.myPendingApprovalId ? 100 : 0) +
          (needsDetails(a) ? 80 : 0) +
          (a.failedDeliveriesCount > 0 ? 60 : 0) +
          (isHighImpact(a) ? 50 : 0) +
          (a.isOverdue ? 40 : 0);
        const bWeight =
          (b.myPendingApprovalId ? 100 : 0) +
          (needsDetails(b) ? 80 : 0) +
          (b.failedDeliveriesCount > 0 ? 60 : 0) +
          (isHighImpact(b) ? 50 : 0) +
          (b.isOverdue ? 40 : 0);
        return bWeight - aWeight;
      })
      .slice(0, 3);
  }, [filteredRows]);

  const cardCounts = useMemo(() => {
    const needsReview = filteredRows.filter((row) => Boolean(row.myPendingApprovalId)).length;
    const needsDetail = filteredRows.filter((row) => needsDetails(row)).length;
    const overdue = filteredRows.filter((row) => row.isOverdue || row.isEscalated).length;
    const highImpact = filteredRows.filter((row) => isHighImpact(row)).length;
    const linkedIssues = filteredRows.filter((row) => row.incidentCount > 0).length;
    return { needsReview, needsDetail, overdue, highImpact, linkedIssues };
  }, [filteredRows]);

  async function runBulkAction(action: BulkAction) {
    try {
      const payload: Record<string, unknown> = { action, changeIds: selectedRows.map((row) => row.changeId) };
      if (action === "RETRY_FAILED") payload.outboxIds = selectedFailedOutboxIds;
      if (action === "MARK_DELIVERED") payload.outboxIds = selectedMarkableOutboxIds;
      const res = await fetch("/api/reviews/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Bulk action failed");
      trackAppEvent("changes_bulk_action_used", {
        action,
        selected_count: selectedRows.length,
        view: resolvedView,
      });
      window.location.href = withQuery(pathname, searchParams, {});
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Bulk action failed");
    }
  }

  function exportSelected() {
    const lines = [
      "change_id,title,status,next_step,owner,due_at",
      ...selectedRows.map((row) =>
        [
          row.changeId,
          (row.title ?? "").replaceAll(",", " "),
          getStatusLabel(row),
          getNextStep(row),
          getOwnerLabel(row, currentUserId),
          row.dueAt ?? "",
        ].join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "changes-export.csv";
    a.click();
    URL.revokeObjectURL(url);
    trackAppEvent("changes_bulk_action_used", {
      action: "EXPORT_SELECTED",
      selected_count: selectedRows.length,
      view: resolvedView,
    });
  }

  const segmentCountMap: Record<CanonicalView, number> = {
    all: counts.in_review,
    "needs-review": counts.my,
    "needs-details": counts.blocked,
    overdue: counts.overdue,
    "delivery-health": counts.delivery,
  };

  return (
    <div className="space-y-4" data-testid={`changes-workspace-${resolvedView}`}>
      <PageHeaderV2
        breadcrumbs={[{ label: "Home", href: "/home" }, { label: "Changes" }]}
        title="Changes"
        description="Track revenue-impacting changes, identify blockers quickly, and take the next best action."
        actions={
          <Link
            href="/intake/new"
            className="inline-flex h-9 items-center justify-center rounded-md bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-contrast)] shadow-sm transition-colors hover:opacity-90"
          >
            Declare Revenue Change
          </Link>
        }
        helpTrigger={<PageHelpDrawer page="changes" />}
      />

      <Card className="shadow-sm">
        <CardBody className="space-y-3">
          <SectionHelp text={HELP_COPY.sections.changes_filters} />
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search title, ID, domain"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              className="w-full max-w-sm"
            />
            <select
              value={domainFilter}
              onChange={(event) => {
                setDomainFilter(event.target.value);
                trackAppEvent("changes_filter_apply", { filter: "domain", value: event.target.value });
              }}
              className="h-9 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"
            >
              <option value="">All domains</option>
              <option value="revenue">Revenue</option>
              <option value="pricing">Pricing</option>
              <option value="contracts">Contracts</option>
            </select>
            <select
              value={impactFilter}
              onChange={(event) => {
                setImpactFilter(event.target.value);
                trackAppEvent("changes_filter_apply", { filter: "impact", value: event.target.value });
              }}
              className="h-9 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"
            >
              <option value="">All impact</option>
              <option value="high">High impact</option>
            </select>
            <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
              High impact logic
              <MetricHelpTooltip metricKey="high_impact" page="changes" section="filters" />
            </span>
            <select
              value={ownerFilter}
              onChange={(event) => {
                setOwnerFilter(event.target.value);
                trackAppEvent("changes_filter_apply", { filter: "owner", value: event.target.value });
              }}
              className="h-9 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"
            >
              <option value="">All owners</option>
              <option value="me">Assigned to me</option>
              <option value="unassigned">Unassigned</option>
            </select>
            <select
              value={sourceModeFilter}
              onChange={(event) => {
                const v = event.target.value;
                setSourceModeFilter(v);
                trackAppEvent("changes_filter_apply", { filter: "sourceMode", value: v });
                router.replace(withQuery(pathname, searchParams, { sourceMode: v || null }));
              }}
              className="h-9 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"
              aria-label="Filter by intake source"
            >
              <option value="">All intake sources</option>
              <option value="NATIVE">Native integrations</option>
              <option value="OTHER_LEGACY">Other / legacy</option>
            </select>
          </div>

          <div className="grid gap-3 md:grid-cols-5">
            <button className="rounded-lg border p-3 text-left" onClick={() => trackAppEvent("changes_summary_card_click", { card: "needs_review" })}>
              <p className="text-xs text-[var(--text-muted)]">Needs review</p>
              <p className="text-xl font-semibold">{cardCounts.needsReview}</p>
            </button>
            <button className="rounded-lg border p-3 text-left" onClick={() => trackAppEvent("changes_summary_card_click", { card: "needs_details" })}>
              <p className="text-xs text-[var(--text-muted)]">Needs details</p>
              <p className="text-xl font-semibold">{cardCounts.needsDetail}</p>
            </button>
            <button className="rounded-lg border p-3 text-left" onClick={() => trackAppEvent("changes_summary_card_click", { card: "overdue" })}>
              <p className="text-xs text-[var(--text-muted)]">Overdue</p>
              <p className="text-xl font-semibold">{cardCounts.overdue}</p>
            </button>
            <button className="rounded-lg border p-3 text-left" onClick={() => trackAppEvent("changes_summary_card_click", { card: "high_impact" })}>
              <p className="text-xs text-[var(--text-muted)]">High impact</p>
              <p className="text-xl font-semibold">{cardCounts.highImpact}</p>
            </button>
            <button className="rounded-lg border p-3 text-left" onClick={() => trackAppEvent("changes_summary_card_click", { card: "linked_issues" })}>
              <p className="text-xs text-[var(--text-muted)]">Linked to issues</p>
              <p className="text-xl font-semibold">{cardCounts.linkedIssues}</p>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {SEGMENTS.map((segment) => (
              <Link
                key={segment.key}
                href={withQuery(pathname, searchParams, { view: segment.key })}
                className={`rounded-full border px-3 py-1 text-sm ${resolvedView === segment.key ? "bg-black text-white" : ""}`}
                onClick={() =>
                  trackAppEvent("changes_segment_change", { from: resolvedView, to: segment.key })
                }
              >
                {segment.label} {segmentCountMap[segment.key] > 0 ? `(${segmentCountMap[segment.key]})` : ""}
              </Link>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <details>
                <summary className="cursor-pointer rounded-md border px-3 py-1 text-sm">Views</summary>
                <div className="absolute mt-2 w-64 rounded-md border bg-white p-2 shadow-md">
                  {savedViews.map((saved) => {
                    const mappedName = LEGACY_VIEW_NAME_MAP[saved.name] ?? saved.name;
                    return (
                      <button
                        key={saved.id}
                        onClick={() => {
                          const v = String(saved.query?.view ?? "all");
                          const mapped =
                            v === "my"
                              ? "needs-review"
                              : v === "in_review"
                              ? "all"
                              : v === "blocked"
                              ? "needs-details"
                              : v === "delivery" || v === "delivery_status"
                              ? "delivery-health"
                              : v;
                          trackAppEvent("changes_saved_view_used", { saved_view_id: saved.id, view: mapped });
                          window.location.href = withQuery(pathname, searchParams, { view: mapped });
                        }}
                        className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-black/5"
                      >
                        {mappedName}
                      </button>
                    );
                  })}
                </div>
              </details>
            </div>
          </div>
        </CardBody>
      </Card>

      {recommended.length > 0 && (
        <Card className="shadow-sm">
          <CardBody>
            <SectionHeader title="Recommended next" />
            <div className="grid gap-2 md:grid-cols-3">
              {recommended.map((row) => (
                <button
                  key={row.changeId}
                  className="rounded-md border p-3 text-left hover:bg-black/5"
                  onClick={() => {
                    setActiveRowId(row.changeId);
                    trackAppEvent("changes_recommended_open", { change_id: row.changeId, next_step: getNextStep(row) });
                  }}
                >
                  <p className="text-sm font-semibold">{row.title ?? "Untitled change"}</p>
                  <p className="text-xs text-[var(--text-muted)]">{getNextStep(row)}</p>
                  <WhySurfacedText
                    text={
                      row.myPendingApprovalId
                        ? HELP_COPY.whySurfaced.awaiting_review
                        : needsDetails(row)
                        ? HELP_COPY.whySurfaced.missing_details
                        : row.failedDeliveriesCount > 0
                        ? HELP_COPY.whySurfaced.delivery_problem
                        : row.incidentCount > 0
                        ? HELP_COPY.whySurfaced.linked_issue
                        : HELP_COPY.whySurfaced.overdue_assigned
                    }
                  />
                </button>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {err && <p className="text-sm text-red-600">{err}</p>}

      <TableShell
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => void runBulkAction("NUDGE_APPROVERS")} disabled={!selectedRows.length}>
              Nudge approvers
            </Button>
            <Button
              onClick={() => void runBulkAction("RETRY_FAILED")}
              disabled={!selectedRows.length || selectedFailedOutboxIds.length === 0}
              variant="secondary"
            >
              Retry failed notifications
            </Button>
            <Button onClick={exportSelected} disabled={!selectedRows.length} variant="secondary">
              Export selected
            </Button>
            {selectedMarkableOutboxIds.length > 0 && resolvedView === "delivery-health" && (
              <Button onClick={() => void runBulkAction("MARK_DELIVERED")} variant="secondary">
                Mark delivered
              </Button>
            )}
          </div>
        }
        loading={loading}
        empty={
          filteredRows.length === 0 ? (
            <EmptyState
              variant={
                searchText || domainFilter || impactFilter || ownerFilter || sourceModeFilter
                  ? "filtered_empty"
                  : "good_empty"
              }
              title={
                resolvedView === "needs-review"
                  ? "No approvals are waiting on you."
                  : resolvedView === "needs-details"
                  ? "No changes are blocked by missing details."
                  : resolvedView === "delivery-health"
                  ? "No delivery problems need attention."
                  : "No changes match this view."
              }
              body={
                searchText || domainFilter || impactFilter || ownerFilter || sourceModeFilter
                  ? "Try clearing filters or broadening your search."
                  : "No immediate follow-up is needed in this view right now."
              }
              action={
                <Link href="/intake/new" className="text-sm font-semibold text-[var(--primary)] hover:underline">
                  Declare a new revenue change
                </Link>
              }
            />
          ) : null
        }
      >
        {filteredRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-[var(--text-muted)]">
                    <th className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={selectedRows.length > 0 && selectedRows.length === filteredRows.length}
                        onChange={(event) => {
                          if (event.target.checked) setSelected(new Set(filteredRows.map((row) => row.changeId)));
                          else setSelected(new Set());
                        }}
                      />
                    </th>
                    <th className="px-2 py-2">Change</th>
                    <th className="px-2 py-2">Owner</th>
                    <th className="px-2 py-2">Reviewers</th>
                    <th className="px-2 py-2">Due</th>
                    <th className="px-2 py-2">
                      <span className="inline-flex items-center gap-1">
                        Status
                        <StatusHelpTooltip
                          statusKey="needs_details"
                          page="changes"
                          section="table-status"
                        />
                      </span>
                    </th>
                    <th className="px-2 py-2">Next step</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.changeId} className="border-b">
                      <td className="px-2 py-2 align-top">
                        <input
                          type="checkbox"
                          checked={selected.has(row.changeId)}
                          onChange={() => {
                            const next = new Set(selected);
                            if (next.has(row.changeId)) next.delete(row.changeId);
                            else next.add(row.changeId);
                            setSelected(next);
                          }}
                        />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <button
                          className="text-left"
                          onClick={() => {
                            setActiveRowId(row.changeId);
                            trackAppEvent("changes_row_open_detail", {
                              change_id: row.changeId,
                              view: resolvedView,
                            });
                          }}
                        >
                          <p className="font-medium">{row.title ?? "Untitled change"}</p>
                          <p className="text-xs text-[var(--text-muted)]">{row.changeId.slice(0, 8)} · {row.domain ?? "Revenue"}</p>
                        </button>
                      </td>
                      <td className="px-2 py-2 align-top">{getOwnerLabel(row, currentUserId)}</td>
                      <td className="px-2 py-2 align-top">{row.pendingApprovalsCount > 0 ? `${row.pendingApprovalsCount} pending` : "None pending"}</td>
                      <td className="px-2 py-2 align-top">{fmtDate(row.dueAt)}</td>
                      <td className="px-2 py-2 align-top">
                        <span className="inline-flex items-center gap-1">
                          {getStatusLabel(row) === "Needs details" ? (
                            <StatusBadge status="needs_details" />
                          ) : getStatusLabel(row) === "Overdue" ? (
                            <StatusBadge status="overdue" />
                          ) : getStatusLabel(row) === "Delivery failed" ? (
                            <StatusBadge status="delivery_issue" />
                          ) : getStatusLabel(row) === "Needs your review" ? (
                            <StatusBadge status="needs_review" />
                          ) : (
                            <StatusBadge status="monitoring" />
                          )}
                          {(getStatusLabel(row) === "Needs details" ||
                            getStatusLabel(row) === "Overdue" ||
                            getStatusLabel(row) === "Delivery failed") && (
                            <MetricHelpTooltip
                              metricKey={
                                getStatusLabel(row) === "Needs details"
                                  ? "needs_details"
                                  : getStatusLabel(row) === "Overdue"
                                  ? "overdue"
                                  : "delivery_issue"
                              }
                              page="changes"
                              section="row-status"
                            />
                          )}
                        </span>
                      </td>
                      <td className="px-2 py-2 align-top">{getNextStep(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </TableShell>

      {activeRow && (
        <>
          <Card className="lg:hidden">
            <CardBody className="space-y-2">
              <p className="text-xs uppercase text-[var(--text-muted)]">Details</p>
              <p className="font-semibold">{activeRow.title ?? "Untitled change"}</p>
              <p className="text-sm">Status: {getStatusLabel(activeRow)}</p>
              <p className="text-sm">Next step: {getNextStep(activeRow)}</p>
              {(needsDetails(activeRow) || activeRow.failedDeliveriesCount > 0) && (
                <WhatHappensNextCallout
                  text={
                    needsDetails(activeRow)
                      ? HELP_COPY.workflowNext.needs_details
                      : HELP_COPY.workflowNext.delivery_issue
                  }
                />
              )}
              {needsDetails(activeRow) && (
                <p className="text-sm">
                  Missing details:{" "}
                  {activeRow.missingEvidenceKinds.length > 0
                    ? activeRow.missingEvidenceKinds.join(", ")
                    : "Required intake or assignment details"}
                </p>
              )}
              <Link href={`/changes/${activeRow.changeId}`} className="text-sm font-semibold text-[var(--primary)] hover:underline">
                Open full change details
              </Link>
            </CardBody>
          </Card>

          <aside className="fixed inset-y-0 right-0 z-30 hidden w-[420px] border-l bg-white p-4 shadow-xl lg:block">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase text-[var(--text-muted)]">Change details</p>
              <button onClick={() => setActiveRowId(null)} className="text-sm text-[var(--text-muted)]">
                Close
              </button>
            </div>
            <div className="mt-3 space-y-3">
              <p className="text-lg font-semibold">{activeRow.title ?? "Untitled change"}</p>
              <p className="text-sm">Status: {getStatusLabel(activeRow)}</p>
              <p className="text-sm">Next step: {getNextStep(activeRow)}</p>
              {(needsDetails(activeRow) || activeRow.failedDeliveriesCount > 0) && (
                <WhatHappensNextCallout
                  text={
                    needsDetails(activeRow)
                      ? HELP_COPY.workflowNext.needs_details
                      : HELP_COPY.workflowNext.delivery_issue
                  }
                />
              )}
              <p className="text-sm">Owner: {getOwnerLabel(activeRow, currentUserId)}</p>
              <p className="text-sm">Reviewers pending: {activeRow.pendingApprovalsCount}</p>
              <p className="text-sm">Delivery health: failed {activeRow.failedDeliveriesCount}, pending {activeRow.pendingDeliveriesCount}</p>
              {needsDetails(activeRow) && (
                <p className="text-sm">
                  Missing details:{" "}
                  {activeRow.missingEvidenceKinds.length > 0
                    ? activeRow.missingEvidenceKinds.join(", ")
                    : "Required intake or assignment details"}
                </p>
              )}
              <Link href={`/changes/${activeRow.changeId}`} className="inline-block text-sm font-semibold text-[var(--primary)] hover:underline">
                Open full change page
              </Link>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
