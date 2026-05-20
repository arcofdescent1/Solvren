"use client";

import { useEffect, useState } from "react";

type SlaEvent = {
  id: string;
  previous_state: string | null;
  new_state: string;
  triggered_by: string;
  created_at: string;
};

export function SlaTimeline({ changeId }: { changeId: string }) {
  const [events, setEvents] = useState<SlaEvent[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr(null);
      const res = await fetch(`/api/sla/events?changeId=${encodeURIComponent(changeId)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (!cancelled) setErr(json?.error ?? "Failed to load SLA events");
        return;
      }
      if (!cancelled) setEvents(json.events ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [changeId]);

  function stateLabel(s: string | null): string {
    if (!s) return "-";
    switch (s) {
      case "DUE_SOON":
        return "Due soon (<= 4h)";
      case "OVERDUE":
        return "Overdue";
      case "ESCALATED":
        return "Escalated";
      case "ON_TRACK":
        return "On track";
      default:
        return s;
    }
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-sm">
      <div>
        <div className="font-semibold">SLA timeline</div>
        <div className="mt-1 text-xs text-[var(--text-muted)]">Transitions are computed by the SLA engine.</div>
      </div>
      {err ? <div className="text-sm text-[var(--danger)]">{err}</div> : null}
      {events.length === 0 ? (
        <div className="text-sm text-[var(--text-muted)]">No SLA transitions recorded yet.</div>
      ) : (
        <div className="space-y-2">
          {events.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] px-3 py-2 text-sm">
              <div className="font-medium">
                {stateLabel(e.previous_state)} {"->"} {stateLabel(e.new_state)}
              </div>
              <div className="text-xs text-[var(--text-muted)]">{new Date(e.created_at).toLocaleString()} - {e.triggered_by}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
