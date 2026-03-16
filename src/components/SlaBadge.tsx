"use client";

import { useMemo, useState, useEffect } from "react";

function formatRemaining(dueAt: string | null, slaStatus: string | null): string {
  if (!dueAt) return "Not submitted";
  const due = new Date(dueAt);
  const now = new Date();
  const ms = due.getTime() - now.getTime();

  if (ms <= 0) {
    const overdueMs = Math.abs(ms);
    const h = Math.floor(overdueMs / (1000 * 60 * 60));
    const m = Math.floor((overdueMs % (1000 * 60 * 60)) / (1000 * 60));
    return `Overdue by ${h}h ${m}m`;
  }

  const h = Math.floor(ms / (1000 * 60 * 60));
  const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return `Due in ${d}d ${rh}h`;
  }
  return `Due in ${h}h ${m}m`;
}

export default function SlaBadge({
  dueAt,
  slaStatus,
  escalatedAt,
}: {
  dueAt: string | null;
  slaStatus: string | null;
  escalatedAt: string | null;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!dueAt) return;
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, [dueAt]);

  const text = useMemo(
    () => formatRemaining(dueAt, slaStatus),
    [dueAt, slaStatus, now]
  );

  const isOverdue = dueAt && new Date(dueAt).getTime() < now;
  const isDueSoon = slaStatus === "DUE_SOON";

  if (!dueAt) {
    return <span className="text-sm opacity-70">Not submitted</span>;
  }

  return (
    <span className="inline-flex flex-col gap-0.5">
      <span
        className={`text-sm ${
          isOverdue
            ? "text-red-600 font-semibold"
            : isDueSoon
              ? "text-amber-600 font-medium"
              : "opacity-80"
        }`}
      >
        {text}
      </span>
      {escalatedAt && (
        <span className="text-xs text-red-600 font-medium">Escalated</span>
      )}
    </span>
  );
}
