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
      const res = await fetch(
        `/api/sla/events?changeId=${encodeURIComponent(changeId)}`
      );
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
    if (!s) return "—";
    switch (s) {
      case "DUE_SOON":
        return "Due soon (≤ 4h)";
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
    <div className="border rounded p-4 space-y-2">
      <div className="font-semibold">SLA timeline</div>
      <div className="text-xs opacity-70">
        Transitions are computed by the SLA engine.
      </div>
      {err ? <div className="text-sm text-red-600">{err}</div> : null}
      {events.length === 0 ? (
        <div className="text-sm opacity-70">
          No SLA transitions recorded yet.
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((e) => (
            <div
              key={e.id}
              className="text-sm flex items-center justify-between gap-3"
            >
              <div className="font-mono">
                {stateLabel(e.previous_state)} → {stateLabel(e.new_state)}
              </div>
              <div className="text-xs opacity-70">
                {new Date(e.created_at).toLocaleString()} • {e.triggered_by}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
