"use client";

import { useState, useEffect } from "react";
import { Button, Card, CardBody, Input } from "@/ui";

type Project = { id: string; key: string; name: string; projectType: string };

type Props = {
  orgId: string;
  selectedKeys: string[];
  onSave: (projectKeys: string[]) => Promise<void>;
  onNext: () => void;
};

export function JiraProjectSelector({ orgId, selectedKeys, onSave, onNext }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedKeys));
  const [search, setSearch] = useState("");

  useEffect(() => {
    setSelected(new Set(selectedKeys));
  }, [selectedKeys]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/integrations/jira/projects?orgId=${encodeURIComponent(orgId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          setProjects([]);
        } else {
          setProjects(data.projects ?? []);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [orgId]);

  const filtered = projects.filter(
    (p) =>
      !search.trim() ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.key.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSave = async () => {
    if (selected.size === 0) {
      setError("Select at least one project");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(Array.from(selected));
      onNext();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardBody className="space-y-4">
        <h3 className="font-semibold text-lg">Select projects</h3>
        <p className="text-sm text-[var(--text-muted)]">
          Choose which Jira projects Solvren should monitor.
        </p>
        {loading ? (
          <p className="text-sm">Loading projects…</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <>
            <Input
              placeholder="Search projects"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <div className="max-h-64 overflow-y-auto space-y-2 rounded border p-3">
              {filtered.map((p) => (
                <label key={p.id} className="flex items-center gap-3 cursor-pointer hover:bg-[var(--bg-surface-2)] rounded px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={selected.has(p.key)}
                    onChange={() => toggle(p.key)}
                    className="rounded"
                  />
                  <span className="font-medium">{p.name}</span>
                  <span className="text-xs text-[var(--text-muted)]">({p.key})</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-[var(--text-muted)]">{selected.size} selected</p>
          </>
        )}
        <Button onClick={handleSave} disabled={loading || saving || selected.size === 0}>
          {saving ? "Saving…" : "Start Monitoring Changes"}
        </Button>
      </CardBody>
    </Card>
  );
}
