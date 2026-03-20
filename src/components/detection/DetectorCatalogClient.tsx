"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardBody } from "@/ui";

type Pack = {
  id: string;
  packKey: string;
  displayName: string;
  description: string;
  businessTheme: string;
  recommendedIntegrations: string[];
};

type Detector = {
  id: string;
  detectorKey: string;
  displayName: string;
  description: string;
  category: string;
  evaluationMode: string;
  requiredSignalKeys: string[];
  defaultSeverity: string;
  status: string;
};

type Config = {
  enabled: boolean;
  rolloutState: string;
};

export function DetectorCatalogClient({ orgId }: { orgId: string }) {
  const [packs, setPacks] = React.useState<Pack[]>([]);
  const [detectors, setDetectors] = React.useState<Detector[]>([]);
  const [configs, setConfigs] = React.useState<Record<string, Config>>({});
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        const [packsRes, detectorsRes] = await Promise.all([
          fetch("/api/admin/detectors/packs"),
          fetch("/api/admin/detectors"),
        ]);
        const packsData = await packsRes.json();
        const detectorsData = await detectorsRes.json();
        setPacks(packsData.packs ?? []);
        setDetectors(detectorsData.detectors ?? []);

        const cfgs: Record<string, Config> = {};
        for (const d of detectorsData.detectors ?? []) {
          const configRes = await fetch(`/api/admin/detectors/${encodeURIComponent(d.detectorKey)}/config`);
          const configData = await configRes.json();
          cfgs[d.detectorKey] = {
            enabled: configData.enabled ?? false,
            rolloutState: configData.rolloutState ?? "off",
          };
        }
        setConfigs(cfgs);
      } finally {
        setLoading(false);
      }
    })();
  }, [orgId]);

  const toggleDetector = async (detectorKey: string, enabled: boolean) => {
    const cfg = configs[detectorKey] ?? { enabled: false, rolloutState: "off" };
    const res = await fetch(`/api/admin/detectors/${encodeURIComponent(detectorKey)}/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, rolloutState: cfg.rolloutState }),
    });
    if (res.ok) {
      setConfigs((prev) => ({
        ...prev,
        [detectorKey]: { ...cfg, enabled },
      }));
    }
  };

  const runDetector = async (detectorKey: string) => {
    await fetch(`/api/admin/detectors/${encodeURIComponent(detectorKey)}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ windowHours: 168 }),
    });
  };

  if (loading) {
    return <div className="text-sm text-[var(--text-muted)]">Loading detector catalog…</div>;
  }

  const byPack = new Map<string, Detector[]>();
  for (const d of detectors) {
    const key = (d as Detector & { detectorPackId?: string }).detectorPackId ?? "other";
    if (!byPack.has(key)) byPack.set(key, []);
    byPack.get(key)!.push(d);
  }

  return (
    <div className="space-y-8">
      {packs.map((pack) => (
        <Card key={pack.id}>
          <CardBody>
            <h2 className="text-lg font-semibold">{pack.displayName}</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{pack.description}</p>
            {pack.recommendedIntegrations?.length > 0 && (
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Integrations: {pack.recommendedIntegrations.join(", ")}
              </p>
            )}
            <div className="mt-4 space-y-3">
              {(byPack.get(pack.id) ?? []).map((d) => {
                const cfg = configs[d.detectorKey] ?? { enabled: false, rolloutState: "off" };
                return (
                  <div
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3"
                  >
                    <div>
                      <Link
                        href={`/admin/detectors/${encodeURIComponent(d.detectorKey)}`}
                        className="font-medium text-[var(--primary)] hover:underline"
                      >
                        {d.displayName}
                      </Link>
                      <p className="text-xs text-[var(--text-muted)]">{d.description}</p>
                      <p className="mt-1 text-xs">
                        Signals: {d.requiredSignalKeys?.join(", ") ?? "—"} · Severity: {d.defaultSeverity}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => runDetector(d.detectorKey)}
                        className="rounded bg-[var(--primary)]/10 px-2 py-1 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary)]/20"
                      >
                        Run now
                      </button>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={cfg.enabled}
                          onChange={(e) => toggleDetector(d.detectorKey, e.target.checked)}
                          className="rounded"
                        />
                        Enabled
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

