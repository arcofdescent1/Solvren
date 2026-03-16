"use client";;
import { Button } from "@/ui";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type MyQueueItem = {
  approvalId: string;
  changeEventId: string;
  title: string | null;
  domain: string | null;
  dueAt: string | null;
  riskBucket: string | null;
  approvalArea: string;
};

type InReviewItem = {
  changeEventId: string;
  title: string | null;
  domain: string | null;
  status: string | null;
  dueAt: string | null;
  riskBucket: string | null;
  riskScore: number | null;
};

type BlockedItem = {
  changeEventId: string;
  title: string | null;
  domain: string | null;
  reason: "missing_evidence" | "approvals_stalled";
  missingEvidenceKinds?: string[];
};

type OverdueItem = {
  changeEventId: string;
  title: string | null;
  domain: string | null;
  dueAt: string | null;
  slaStatus: string | null;
};

type DeliveryIssueItem = {
  outboxId: string;
  changeEventId: string | null;
  channel: string | null;
  templateKey: string | null;
  lastError: string | null;
};

type OpsInboxData = {
  ok: boolean;
  myQueue: MyQueueItem[];
  inReview: InReviewItem[];
  blocked: BlockedItem[];
  overdue: OverdueItem[];
  deliveryIssues: DeliveryIssueItem[];
};

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString();
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
  return (
    <span className={`px-2 py-0.5 rounded text-xs ${cls}`}>{children}</span>
  );
}

export default function OpsInbox() {
  const [data, setData] = useState<OpsInboxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/ops-inbox");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load ops inbox");
      setData(json);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const retryDelivery = useCallback(
    async (outboxId: string) => {
      const key = `retry-${outboxId}`;
      setActionLoading(key);
      try {
        const res = await fetch("/api/notifications/retry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outboxId }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Retry failed");
        showToast("Retry queued.");
        load();
      } catch (e: unknown) {
        showToast(e instanceof Error ? e.message : "Retry failed");
      } finally {
        setActionLoading(null);
      }
    },
    [load, showToast]
  );

  const nudgeEvidence = useCallback(
    async (changeEventId: string) => {
      const key = `nudge-${changeEventId}`;
      setActionLoading(key);
      try {
        const res = await fetch("/api/ops-inbox/nudge-evidence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ changeEventId }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Nudge failed");
        showToast(json?.message ?? "Nudge sent.");
        load();
      } catch (e: unknown) {
        showToast(e instanceof Error ? e.message : "Nudge failed");
      } finally {
        setActionLoading(null);
      }
    },
    [load, showToast]
  );

  const escalateSla = useCallback(
    async (changeEventId: string) => {
      const key = `escalate-${changeEventId}`;
      setActionLoading(key);
      try {
        const res = await fetch("/api/ops-inbox/escalate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ changeEventId }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Escalate failed");
        showToast("Escalated.");
        load();
      } catch (e: unknown) {
        showToast(e instanceof Error ? e.message : "Escalate failed");
      } finally {
        setActionLoading(null);
      }
    },
    [load, showToast]
  );

  if (loading && !data) {
    return (
      <div className="p-6">
        <div className="text-sm opacity-70">Loading ops inbox…</div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="p-6">
        <div className="text-sm text-red-600">{err}</div>
        <Button className="mt-2 text-sm underline" onClick={load}>
          Retry
        </Button>
      </div>
    );
  }

  const d = data!;

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div>
        <Link href="/dashboard" className="text-sm underline mb-2 inline-block">
          ← Dashboard
        </Link>
        <h1 className="text-xl font-semibold">Ops Inbox</h1>
        <p className="text-sm opacity-70">
          My queue · In review · Blocked · Overdue · Delivery issues
        </p>
      </div>
      {toast && (
        <div className="fixed bottom-4 right-4 rounded border bg-white px-3 py-2 text-sm shadow-lg z-10">
          {toast}
        </div>
      )}
      <Section
        title="My queue"
        subtitle="Awaiting your approval (due soonest first)"
        count={d.myQueue.length}
      >
        {d.myQueue.length === 0 ? (
          <Empty />
        ) : (
          d.myQueue.map((q) => (
            <Row key={q.approvalId}>
              <Link
                href={`/changes/${q.changeEventId}`}
                className="font-medium text-blue-600 underline"
              >
                {q.title || "(untitled)"}
              </Link>
              <Meta>
                {q.domain && <Badge tone="neutral">{q.domain}</Badge>}
                {q.riskBucket && (
                  <Badge tone="warn">{q.riskBucket}</Badge>
                )}
                Due {fmtDate(q.dueAt)} · {q.approvalArea}
              </Meta>
              <Actions>
                <Link
                  href={`/changes/${q.changeEventId}`}
                  className="text-sm px-2 py-1 rounded border hover:bg-black/5"
                >
                  Open
                </Link>
              </Actions>
            </Row>
          ))
        )}
      </Section>
      <Section
        title="In review"
        subtitle="All org changes in review (by bucket + due)"
        count={d.inReview.length}
      >
        {d.inReview.length === 0 ? (
          <Empty />
        ) : (
          d.inReview.map((r) => (
            <Row key={r.changeEventId}>
              <Link
                href={`/changes/${r.changeEventId}`}
                className="font-medium text-blue-600 underline"
              >
                {r.title || "(untitled)"}
              </Link>
              <Meta>
                {r.domain && <Badge tone="neutral">{r.domain}</Badge>}
                {r.riskBucket && (
                  <Badge tone="neutral">{r.riskBucket}</Badge>
                )}
                {r.riskScore != null && (
                  <span className="text-xs opacity-70">score {Math.round(r.riskScore)}</span>
                )}
                Due {fmtDate(r.dueAt)}
              </Meta>
              <Actions>
                <Link
                  href={`/changes/${r.changeEventId}`}
                  className="text-sm px-2 py-1 rounded border hover:bg-black/5"
                >
                  Open
                </Link>
                <Button
                  type="button"
                  className="text-sm px-2 py-1 rounded border border-amber-400 hover:bg-amber-50 disabled:opacity-50"
                  disabled={actionLoading !== null}
                  onClick={() => escalateSla(r.changeEventId)}
                >
                  {actionLoading === `escalate-${r.changeEventId}` ? "…" : "Escalate SLA"}
                </Button>
              </Actions>
            </Row>
          ))
        )}
      </Section>
      <Section
        title="Blocked"
        subtitle="Missing required evidence or approvals stalled"
        count={d.blocked.length}
      >
        {d.blocked.length === 0 ? (
          <Empty />
        ) : (
          d.blocked.map((b) => (
            <Row key={b.changeEventId}>
              <Link
                href={`/changes/${b.changeEventId}`}
                className="font-medium text-blue-600 underline"
              >
                {b.title || "(untitled)"}
              </Link>
              <Meta>
                {b.domain && <Badge tone="neutral">{b.domain}</Badge>}
                {b.reason === "missing_evidence" && (
                  <Badge tone="warn">
                    Missing: {b.missingEvidenceKinds?.join(", ") ?? "evidence"}
                  </Badge>
                )}
                {b.reason === "approvals_stalled" && (
                  <Badge tone="info">Approvals stalled</Badge>
                )}
              </Meta>
              <Actions>
                <Link
                  href={`/changes/${b.changeEventId}`}
                  className="text-sm px-2 py-1 rounded border hover:bg-black/5"
                >
                  Open
                </Link>
                <Button
                  type="button"
                  className="text-sm px-2 py-1 rounded border border-amber-400 hover:bg-amber-50 disabled:opacity-50"
                  disabled={actionLoading !== null}
                  onClick={() => nudgeEvidence(b.changeEventId)}
                >
                  {actionLoading === `nudge-${b.changeEventId}` ? "…" : "Nudge evidence"}
                </Button>
                <Button
                  type="button"
                  className="text-sm px-2 py-1 rounded border border-amber-400 hover:bg-amber-50 disabled:opacity-50"
                  disabled={actionLoading !== null}
                  onClick={() => escalateSla(b.changeEventId)}
                >
                  {actionLoading === `escalate-${b.changeEventId}` ? "…" : "Escalate SLA"}
                </Button>
              </Actions>
            </Row>
          ))
        )}
      </Section>
      <Section
        title="Overdue / escalated"
        subtitle="IN_REVIEW past due or sla_status OVERDUE/ESCALATED"
        count={d.overdue.length}
      >
        {d.overdue.length === 0 ? (
          <Empty />
        ) : (
          d.overdue.map((o) => (
            <Row key={o.changeEventId}>
              <Link
                href={`/changes/${o.changeEventId}`}
                className="font-medium text-blue-600 underline"
              >
                {o.title || "(untitled)"}
              </Link>
              <Meta>
                {o.domain && <Badge tone="neutral">{o.domain}</Badge>}
                {o.slaStatus && (
                  <Badge tone="danger">{o.slaStatus}</Badge>
                )}
                Due {fmtDate(o.dueAt)}
              </Meta>
              <Actions>
                <Link
                  href={`/changes/${o.changeEventId}`}
                  className="text-sm px-2 py-1 rounded border hover:bg-black/5"
                >
                  Open
                </Link>
                <Button
                  type="button"
                  className="text-sm px-2 py-1 rounded border border-amber-400 hover:bg-amber-50 disabled:opacity-50"
                  disabled={actionLoading !== null}
                  onClick={() => escalateSla(o.changeEventId)}
                >
                  {actionLoading === `escalate-${o.changeEventId}` ? "…" : "Escalate SLA"}
                </Button>
              </Actions>
            </Row>
          ))
        )}
      </Section>
      <Section
        title="Delivery issues"
        subtitle="Failed notifications (retry to re-queue)"
        count={d.deliveryIssues.length}
      >
        {d.deliveryIssues.length === 0 ? (
          <Empty />
        ) : (
          d.deliveryIssues.map((i) => (
            <Row key={i.outboxId}>
              <div>
                <span className="font-medium">
                  {i.templateKey ?? "notification"} ({i.channel ?? "—"})
                </span>
                {i.changeEventId && (
                  <Link
                    href={`/changes/${i.changeEventId}`}
                    className="ml-2 text-blue-600 underline text-sm"
                  >
                    View change
                  </Link>
                )}
              </div>
              <Meta>
                {i.lastError && (
                  <span className="text-xs text-red-600 truncate max-w-md block">
                    {i.lastError}
                  </span>
                )}
              </Meta>
              <Actions>
                {i.changeEventId && (
                  <Link
                    href={`/changes/${i.changeEventId}`}
                    className="text-sm px-2 py-1 rounded border hover:bg-black/5"
                  >
                    Open change
                  </Link>
                )}
                <Button
                  type="button"
                  className="text-sm px-2 py-1 rounded border border-green-600 hover:bg-green-50 disabled:opacity-50"
                  disabled={actionLoading !== null}
                  onClick={() => retryDelivery(i.outboxId)}
                >
                  {actionLoading === `retry-${i.outboxId}` ? "…" : "Retry delivery"}
                </Button>
              </Actions>
            </Row>
          ))
        )}
      </Section>
      <div className="flex justify-end">
        <Button className="text-sm underline opacity-70" onClick={load}>
          Refresh
        </Button>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  count,
  children,
}: {
  title: string;
  subtitle: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-lg font-medium">
          {title}
          {count > 0 && (
            <span className="ml-2 text-sm font-normal opacity-70">
              ({count})
            </span>
          )}
        </h2>
        <p className="text-xs opacity-70">{subtitle}</p>
      </div>
      <div className="border rounded divide-y">{children}</div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-3 flex flex-wrap items-start gap-2 sm:gap-4">
      {children}
    </div>
  );
}

function Meta({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 text-xs opacity-80 w-full">{children}</div>;
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 ml-auto">{children}</div>;
}

function Empty() {
  return <div className="p-3 text-sm opacity-60">None</div>;
}
