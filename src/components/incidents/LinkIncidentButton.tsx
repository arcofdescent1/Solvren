"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, CardBody, CardDescription, CardHeader, CardTitle, Input, Textarea } from "@/ui";

type Props = {
  changeEventId: string;
  orgId: string;
  onCreated?: () => void;
};

type SearchIncident = {
  id: string;
  severity: number;
  revenue_impact: number | null;
  detected_at: string;
  resolved_at: string | null;
  description: string | null;
  change_event_id: string | null;
};

export default function LinkIncidentButton({ changeEventId, orgId, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"create" | "existing">("create");
  const [severity, setSeverity] = useState(3);
  const [revenueImpact, setRevenueImpact] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchIncident[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function submitCreate() {
    setSaving(true);
    setError(null);

    const hasDesc = Boolean(description.trim());
    const hasImpact = Boolean(revenueImpact.trim());
    if (severity < 4 && !hasDesc && !hasImpact) {
      setSaving(false);
      setError("Add a description or revenue impact, or use severity 4-5.");
      return;
    }

    try {
      const res = await fetch("/api/incidents/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          changeEventId,
          orgId,
          domain: "REVENUE",
          severity,
          revenueImpact: revenueImpact.trim() ? Number(revenueImpact) : null,
          detectedAt: new Date().toISOString(),
          description: description.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create incident");
      setOpen(false);
      setRevenueImpact("");
      setDescription("");
      onCreated?.();
      window.dispatchEvent(new CustomEvent("incident-linked", { detail: { changeEventId } }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  async function searchExisting() {
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/incidents/search?orgId=${encodeURIComponent(orgId)}&q=${encodeURIComponent(q.trim())}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to search incidents");
      setResults(json.incidents || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSearching(false);
    }
  }

  async function linkSelected() {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/incidents/link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ incidentId: selectedId, changeEventId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to link incident");
      setOpen(false);
      onCreated?.();
      window.dispatchEvent(new CustomEvent("incident-linked", { detail: { changeEventId } }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (open && tab === "existing") searchExisting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab]);

  return (
    <>
      <Button className="h-10" onClick={() => setOpen(true)}>Link incident</Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-2xl shadow-2xl">
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Link incident</CardTitle>
                <CardDescription>Connect a known customer or revenue issue to this change.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Close</Button>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-1">
                <Button type="button" variant={tab === "create" ? "default" : "ghost"} size="sm" onClick={() => setTab("create")}>Create new</Button>
                <Button type="button" variant={tab === "existing" ? "default" : "ghost"} size="sm" onClick={() => setTab("existing")}>Link existing</Button>
              </div>

              {error ? <div className="rounded-[var(--radius-md)] border border-red-300 bg-red-50 p-3 text-sm text-red-950">{error}</div> : null}

              {tab === "create" ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-sm font-medium">
                      Severity
                      <Input type="number" min={1} max={5} value={severity} onChange={(e) => setSeverity(Number(e.target.value))} />
                    </label>
                    <label className="space-y-1 text-sm font-medium">
                      Revenue impact
                      <Input placeholder="e.g. 2500" value={revenueImpact} onChange={(e) => setRevenueImpact(e.target.value)} />
                    </label>
                  </div>
                  <label className="block space-y-1 text-sm font-medium">
                    What happened?
                    <Textarea className="min-h-24" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Symptoms, customer impact, or detection details" />
                  </label>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button disabled={saving} onClick={submitCreate}>{saving ? "Linking..." : "Link incident"}</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input placeholder="Search open incidents" value={q} onChange={(e) => setQ(e.target.value)} />
                    <Button type="button" variant="secondary" onClick={searchExisting} disabled={searching}>{searching ? "Searching..." : "Search"}</Button>
                  </div>
                  <div className="max-h-72 overflow-auto rounded-[var(--radius-md)] border border-[var(--border)]">
                    {results.map((i) => {
                      const linked = Boolean(i.change_event_id);
                      return (
                        <label key={i.id} className="flex cursor-pointer gap-3 border-b border-[var(--border)] p-3 text-sm last:border-b-0">
                          <input type="radio" name="incident" checked={selectedId === i.id} onChange={() => setSelectedId(i.id)} disabled={linked} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">Severity {i.severity}</Badge>
                                {i.revenue_impact != null ? <Badge variant="secondary">${i.revenue_impact.toLocaleString()}</Badge> : null}
                                {linked ? <Badge variant="warning">Already linked</Badge> : null}
                              </div>
                              <span className="text-xs text-[var(--text-muted)]">{new Date(i.detected_at).toLocaleString()}</span>
                            </div>
                            {i.description ? <p className="mt-2 text-xs text-[var(--text-muted)]">{i.description}</p> : null}
                          </div>
                        </label>
                      );
                    })}
                    {results.length === 0 ? <div className="p-4 text-sm text-[var(--text-muted)]">No open incidents found.</div> : null}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button disabled={saving || !selectedId} onClick={linkSelected}>{saving ? "Linking..." : "Link selected"}</Button>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      ) : null}
    </>
  );
}
