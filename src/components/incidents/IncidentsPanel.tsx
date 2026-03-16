"use client";;
import { Button, Input, Textarea } from "@/ui";

import { useEffect, useState } from "react";

type Incident = {
  id: string;
  severity: number;
  revenue_impact: number | null;
  detected_at: string;
  resolved_at: string | null;
  description: string | null;
};

export default function IncidentsPanel({ changeEventId }: { changeEventId: string }) {
  const [items, setItems] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [editId, setEditId] = useState<string | null>(null);
  const [editSeverity, setEditSeverity] = useState(3);
  const [editRevenueImpact, setEditRevenueImpact] = useState<string>("");
  const [editDescription, setEditDescription] = useState<string>("");

  async function reload() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/incidents/by-change?changeEventId=${changeEventId}`);
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
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changeEventId]);

  useEffect(() => {
    function onLinked(e: Event) {
      const ev = e as CustomEvent;
      if (ev?.detail?.changeEventId === changeEventId) reload();
    }
    window.addEventListener("incident-linked", onLinked as EventListener);
    return () => window.removeEventListener("incident-linked", onLinked as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changeEventId]);

  function openEdit(i: Incident) {
    setEditId(i.id);
    setEditSeverity(i.severity);
    setEditRevenueImpact(i.revenue_impact != null ? String(i.revenue_impact) : "");
    setEditDescription(i.description ?? "");
  }

  async function saveEdit() {
    if (!editId) return;
    const revenueImpact = editRevenueImpact.trim() ? Number(editRevenueImpact) : null;

    const res = await fetch("/api/incidents/update", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        incidentId: editId,
        severity: editSeverity,
        revenueImpact,
        description: editDescription.trim() || null,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      setErr(json?.error || "Failed to update incident");
      return;
    }
    setEditId(null);
    await reload();
  }

  async function resolveIncident(id: string) {
    if (!confirm("Mark this incident as resolved?")) return;
    const res = await fetch("/api/incidents/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ incidentId: id }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErr(json?.error || "Failed to resolve incident");
      return;
    }
    await reload();
  }

  async function unlinkIncident(id: string) {
    if (!confirm("Unlink this incident from the change? (This affects learning.)")) return;
    const res = await fetch("/api/incidents/unlink", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ incidentId: id }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErr(json?.error || "Failed to unlink incident");
      return;
    }
    await reload();
  }

  return (
    <div className="border rounded p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Linked incidents</h3>
        <Button className="text-sm underline opacity-70" onClick={reload}>
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
                  {i.revenue_impact != null && <span className="opacity-80"> • ${i.revenue_impact}</span>}
                </div>
                <div className="opacity-70 text-xs">{new Date(i.detected_at).toLocaleString()}</div>
              </div>
              {i.description && <div className="mt-1 opacity-80">{i.description}</div>}
              <div className="mt-2 flex gap-2">
                <Button className="px-2 py-1 border rounded text-xs" onClick={() => openEdit(i)}>
                  Edit
                </Button>
                {!i.resolved_at && (
                  <Button className="px-2 py-1 border rounded text-xs" onClick={() => resolveIncident(i.id)}>
                    Resolve
                  </Button>
                )}
                <Button className="px-2 py-1 border rounded text-xs" onClick={() => unlinkIncident(i.id)}>
                  Unlink
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      {editId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded border w-full max-w-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Edit incident</h3>
              <Button className="text-sm opacity-70" onClick={() => setEditId(null)}>
                Close
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                Severity (1–5)
                <Input
                  className="mt-1 w-full border rounded px-2 py-1"
                  type="number"
                  min={1}
                  max={5}
                  value={editSeverity}
                  onChange={(e) => setEditSeverity(Number(e.target.value))}
                />
              </label>

              <label className="text-sm">
                Revenue impact
                <Input
                  className="mt-1 w-full border rounded px-2 py-1"
                  value={editRevenueImpact}
                  onChange={(e) => setEditRevenueImpact(e.target.value)}
                />
              </label>
            </div>

            <label className="text-sm block">
              Description
              <Textarea
                className="mt-1 w-full border rounded px-2 py-1"
                rows={3}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </label>

            <div className="flex gap-2 justify-end">
              <Button className="px-3 py-2 rounded border text-sm" onClick={() => setEditId(null)}>
                Cancel
              </Button>
              <Button className="px-3 py-2 rounded border text-sm" onClick={saveEdit}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
