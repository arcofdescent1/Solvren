"use client";;
import { Button } from "@/ui";

import { useEffect, useState } from "react";

type Incident = {
  id: string;
  severity: number;
  revenue_impact: number | null;
  detected_at: string;
  resolved_at: string | null;
  description: string | null;
};

export default function IncidentsList({ changeEventId }: { changeEventId: string }) {
  const [items, setItems] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/incidents/by-change?changeEventId=${encodeURIComponent(changeEventId)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load incidents");
      setItems(json.incidents || []);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [changeEventId]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { changeEventId?: string };
      if (detail?.changeEventId === changeEventId) load();
    };
    window.addEventListener("incident-linked", handler);
    return () => window.removeEventListener("incident-linked", handler);
  }, [changeEventId]);

  return (
    <div className="border rounded p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Linked incidents</h3>
        <Button className="text-sm opacity-70 underline" onClick={load}>
          Refresh
        </Button>
      </div>
      {loading && <div className="text-sm opacity-70">Loading…</div>}
      {err && <div className="text-sm text-red-600">{err}</div>}
      {!loading && items.length === 0 && (
        <div className="text-sm opacity-70">No incidents linked to this change yet.</div>
      )}
      <div className="space-y-2">
        {items.map((i) => {
          const status = i.resolved_at ? "Resolved" : "Open";
          return (
            <div key={i.id} className="border rounded p-2 text-sm">
              <div className="flex justify-between gap-3">
                <div>
                  <b>Severity {i.severity}</b> • {status}
                  {i.revenue_impact != null && (
                    <span className="opacity-80"> • ${i.revenue_impact}</span>
                  )}
                </div>
                <div className="opacity-70 text-xs">
                  {new Date(i.detected_at).toLocaleString()}
                </div>
              </div>
              {i.description && <div className="mt-1 opacity-80">{i.description}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
