"use client";

import * as React from "react";
import { Card, CardBody } from "@/ui";
import type { DetectorDefinitionRow } from "@/modules/detection/domain/detector-definition";

export function DetectorDetailClient({
  orgId: _orgId,
  detectorKey,
  detector,
}: {
  orgId: string;
  detectorKey: string;
  detector: DetectorDefinitionRow;
}) {
  const [config, setConfig] = React.useState<{ enabled: boolean; rolloutState: string } | null>(null);
  const [runs, setRuns] = React.useState<Array<{ id: string; status: string; startedAt: string }>>([]);
  const [findings, setFindings] = React.useState<Array<{ id: string; findingStatus: string }>>([]);

  React.useEffect(() => {
    (async () => {
      const [configRes, runsRes, findingsRes] = await Promise.all([
        fetch(`/api/admin/detectors/${encodeURIComponent(detectorKey)}/config`),
        fetch(`/api/admin/detectors/${encodeURIComponent(detectorKey)}/runs?limit=10`),
        fetch(`/api/admin/detectors/${encodeURIComponent(detectorKey)}/findings?limit=20`),
      ]);
      const configData = await configRes.json();
      const runsData = await runsRes.json();
      const findingsData = await findingsRes.json();
      setConfig({ enabled: configData.enabled ?? false, rolloutState: configData.rolloutState ?? "off" });
      setRuns(runsData.runs ?? []);
      setFindings(findingsData.findings ?? []);
    })();
  }, [detectorKey]);

  const updateConfig = async (updates: { enabled?: boolean; rolloutState?: string }) => {
    const res = await fetch(`/api/admin/detectors/${encodeURIComponent(detectorKey)}/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...config, ...updates }),
    });
    if (res.ok) setConfig((c) => (c ? { ...c, ...updates } : null));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardBody>
          <h3 className="font-semibold">Business problem</h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{detector.business_problem}</p>
          <h3 className="mt-4 font-semibold">Why it matters</h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{detector.why_it_matters}</p>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h3 className="font-semibold">Configuration</h3>
          {config && (
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) => updateConfig({ enabled: e.target.checked })}
                  className="rounded"
                />
                Enabled
              </label>
              <div className="flex items-center gap-2 text-sm">
                <span>Rollout:</span>
                <select
                  value={config.rolloutState}
                  onChange={(e) => updateConfig({ rolloutState: e.target.value })}
                  className="rounded border border-[var(--border)] bg-[var(--input-bg)] px-2 py-1"
                >
                  <option value="off">Off</option>
                  <option value="observe_only">Observe only</option>
                  <option value="full">Full (create issues)</option>
                </select>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h3 className="font-semibold">Required signals</h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {(detector.required_signal_keys_json ?? []).join(", ")}
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h3 className="font-semibold">Recent runs</h3>
          {runs.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--text-muted)]">No runs yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {runs.map((r) => (
                <li key={r.id} className="text-sm">
                  {r.status} · {new Date(r.startedAt).toLocaleString()}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h3 className="font-semibold">Recent findings</h3>
          {findings.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--text-muted)]">No findings yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {findings.map((f) => (
                <li key={f.id} className="text-sm">
                  {f.findingStatus} · <a href={`/admin/detectors/${detectorKey}/findings/${f.id}`} className="text-[var(--primary)] hover:underline">{f.id.slice(0, 8)}…</a>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
