"use client";;
import { Button, Input, Textarea } from "@/ui";

import { useEffect, useState } from "react";

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
  const [revenueImpact, setRevenueImpact] = useState<string>("");
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
      setError("Add a description or revenue impact (or use severity 4–5).");
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
      <Button className="px-3 py-2 rounded border text-sm" onClick={() => setOpen(true)}>
        Link incident
      </Button>
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded border w-full max-w-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Link incident</h3>
              <Button className="text-sm opacity-70" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                className={`px-2 py-1 border rounded text-sm ${tab === "create" ? "bg-black/5" : ""}`}
                onClick={() => setTab("create")}
              >
                Create new
              </Button>
              <Button
                type="button"
                className={`px-2 py-1 border rounded text-sm ${tab === "existing" ? "bg-black/5" : ""}`}
                onClick={() => setTab("existing")}
              >
                Link existing
              </Button>
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}

            {tab === "create" ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm">
                    Severity (1–5)
                    <Input
                      className="mt-1 w-full border rounded px-2 py-1"
                      type="number"
                      min={1}
                      max={5}
                      value={severity}
                      onChange={(e) => setSeverity(Number(e.target.value))}
                    />
                  </label>

                  <label className="text-sm">
                    Revenue impact (optional)
                    <Input
                      className="mt-1 w-full border rounded px-2 py-1"
                      placeholder="e.g. 2500"
                      value={revenueImpact}
                      onChange={(e) => setRevenueImpact(e.target.value)}
                    />
                  </label>
                </div>

                <label className="text-sm block">
                  Description (optional)
                  <Textarea
                    className="mt-1 w-full border rounded px-2 py-1"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What happened? Symptoms? Detection?"
                  />
                </label>

                <div className="flex gap-2 justify-end">
                  <Button className="px-3 py-2 rounded border text-sm" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button className="px-3 py-2 rounded border text-sm" disabled={saving} onClick={submitCreate}>
                    {saving ? "Linking…" : "Link incident"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex gap-2">
                  <Input
                    className="w-full border rounded px-2 py-1 text-sm"
                    placeholder="Search open incidents (description contains…) "
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                  <Button type="button" className="px-3 py-2 rounded border text-sm" onClick={searchExisting} disabled={searching}>
                    {searching ? "…" : "Search"}
                  </Button>
                </div>

                <div className="border rounded max-h-64 overflow-auto">
                  {(results ?? []).map((i) => {
                    const linked = Boolean(i.change_event_id);
                    return (
                      <label key={i.id} className="flex gap-2 p-2 border-b last:border-b-0 text-sm cursor-pointer">
                        <Input
                          type="radio"
                          name="incident"
                          checked={selectedId === i.id}
                          onChange={() => setSelectedId(i.id)}
                          disabled={linked}
                        />
                        <div className="flex-1">
                          <div className="flex justify-between">
                            <div>
                              <b>Severity {i.severity}</b>
                              {i.revenue_impact != null && <span className="opacity-80"> • ${i.revenue_impact}</span>}
                              {linked && <span className="ml-2 text-xs opacity-60">(already linked)</span>}
                            </div>
                            <div className="text-xs opacity-70">{new Date(i.detected_at).toLocaleString()}</div>
                          </div>
                          {i.description && <div className="text-xs opacity-80 mt-1">{i.description}</div>}
                        </div>
                      </label>
                    );
                  })}
                  {(!results || results.length === 0) && (
                    <div className="p-2 text-sm opacity-70">No open incidents found.</div>
                  )}
                </div>

                <div className="flex gap-2 justify-end">
                  <Button className="px-3 py-2 rounded border text-sm" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button className="px-3 py-2 rounded border text-sm" disabled={saving || !selectedId} onClick={linkSelected}>
                    {saving ? "Linking…" : "Link selected"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
