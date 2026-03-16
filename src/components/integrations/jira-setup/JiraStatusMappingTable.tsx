"use client";

import { useState, useEffect } from "react";
import { Button, Card, CardBody } from "@/ui";

const DEFAULTS: Record<string, string> = {
  "To Do": "DRAFT",
  "Open": "DRAFT",
  "In Progress": "READY",
  "In Review": "IN_REVIEW",
  "Done": "APPROVED",
  "Rejected": "REJECTED",
};

type Props = {
  orgId: string;
  initialMappings: Record<string, string>;
  onSave: (m: Record<string, string>) => Promise<void>;
  onNext: () => void;
};

export function JiraStatusMappingTable({ orgId, initialMappings, onSave, onNext }: Props) {
  const [jiraStatuses, setJiraStatuses] = useState<{ id: string; name: string }[]>([]);
  const [rgStatuses, setRgStatuses] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mappings, setMappings] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([
      fetch(`/api/integrations/jira/statuses?orgId=${encodeURIComponent(orgId)}`),
      fetch("/api/change-statuses"),
    ]).then(async ([jRes, rRes]) => {
      const jData = await jRes.json();
      const rData = await rRes.json();
      if (jData.error) throw new Error(jData.error);
      setJiraStatuses(jData.statuses ?? []);
      setRgStatuses(rData.statuses ?? []);
      const js = jData.statuses ?? [];
      const m: Record<string, string> = {};
      for (const s of js) {
        m[s.name] = initialMappings[s.name] ?? DEFAULTS[s.name] ?? "DRAFT";
      }
      setMappings(m);
    }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [orgId, initialMappings]);

  const update = (jiraName: string, rgValue: string) => {
    setMappings((p) => ({ ...p, [jiraName]: rgValue }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(mappings);
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
        <h3 className="font-semibold text-lg">Map statuses</h3>
        <p className="text-sm text-[var(--text-muted)]">Map Jira statuses to Solvren.</p>
        {loading ? <p className="text-sm">Loading…</p> : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b"><th className="text-left py-2">Jira</th><th className="text-left py-2">RG</th></tr>
            </thead>
            <tbody>
              {jiraStatuses.map((s) => (
                <tr key={s.id} className="border-b">
                  <td className="py-2">{s.name}</td>
                  <td className="py-2">
                    <select value={mappings[s.name] ?? "DRAFT"} onChange={(e) => update(s.name, e.target.value)} className="rounded border px-2 py-1">
                      {rgStatuses.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Button onClick={handleSave} disabled={loading || saving}>{saving ? "Saving…" : "Save"}</Button>
      </CardBody>
    </Card>
  );
}
