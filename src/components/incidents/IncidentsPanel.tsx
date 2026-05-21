"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, CardBody, CardDescription, CardHeader, CardTitle, Input, Textarea } from "@/ui";

type Incident = {
  id: string;
  severity: number;
  revenue_impact: number | null;
  detected_at: string;
  resolved_at: string | null;
  description: string | null;
};

function money(value: number | null) {
  if (value == null) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export default function IncidentsPanel({ changeEventId }: { changeEventId: string }) {
  const [items, setItems] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editSeverity, setEditSeverity] = useState(3);
  const [editRevenueImpact, setEditRevenueImpact] = useState("");
  const [editDescription, setEditDescription] = useState("");

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
      body: JSON.stringify({ incidentId: editId, severity: editSeverity, revenueImpact, description: editDescription.trim() || null }),
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
    <>
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Linked incidents</CardTitle>
            <CardDescription>Customer or revenue issues connected to this change.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={reload}>Refresh</Button>
        </CardHeader>
        <CardBody className="space-y-3">
          {loading ? <p className="text-sm text-[var(--text-muted)]">Loading incidents...</p> : null}
          {err ? <p className="text-sm text-[var(--danger)]">{err}</p> : null}
          {!loading && items.length === 0 ? (
            <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--bg-surface-2)] p-4 text-sm text-[var(--text-muted)]">
              No incidents are linked to this change yet.
            </div>
          ) : null}
          {items.map((i) => (
            <div key={i.id} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-4 text-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={i.resolved_at ? "success" : "warning"}>{i.resolved_at ? "Resolved" : "Open"}</Badge>
                    <Badge variant="outline">Severity {i.severity}</Badge>
                    {money(i.revenue_impact) ? <Badge variant="secondary">{money(i.revenue_impact)}</Badge> : null}
                  </div>
                  {i.description ? <p className="mt-2 text-[var(--text-muted)]">{i.description}</p> : null}
                  <p className="mt-2 text-xs text-[var(--text-muted)]">Detected {new Date(i.detected_at).toLocaleString()}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(i)}>Edit</Button>
                  {!i.resolved_at ? <Button size="sm" variant="secondary" onClick={() => resolveIncident(i.id)}>Resolve</Button> : null}
                  <Button size="sm" variant="ghost" onClick={() => unlinkIncident(i.id)}>Unlink</Button>
                </div>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      {editId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-lg shadow-2xl">
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Edit incident</CardTitle>
                <CardDescription>Update severity, estimated impact, or the incident description.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setEditId(null)}>Close</Button>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm font-medium">
                  Severity
                  <Input type="number" min={1} max={5} value={editSeverity} onChange={(e) => setEditSeverity(Number(e.target.value))} />
                </label>
                <label className="space-y-1 text-sm font-medium">
                  Revenue impact
                  <Input value={editRevenueImpact} onChange={(e) => setEditRevenueImpact(e.target.value)} />
                </label>
              </div>
              <label className="block space-y-1 text-sm font-medium">
                Description
                <Textarea className="min-h-24" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
              </label>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditId(null)}>Cancel</Button>
                <Button onClick={saveEdit}>Save</Button>
              </div>
            </CardBody>
          </Card>
        </div>
      ) : null}
    </>
  );
}
