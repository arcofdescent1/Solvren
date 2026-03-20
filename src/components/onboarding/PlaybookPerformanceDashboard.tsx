"use client";

/**
 * Phase 10 — Playbook performance dashboard (§16, §19.6).
 */
import { useCallback, useEffect, useState } from "react";
import { PlaybookPerformanceCard } from "./PlaybookPerformanceCard";

type Playbook = {
  playbookKey: string;
  displayName: string;
  healthState: string;
  performanceScore: number;
  recoveredAmount: number;
  avoidedAmount: number;
  savingsAmount: number;
  runCount: number;
  verificationSuccessRate?: number | null;
  automationRate?: number | null;
  lastActivity?: string | null;
};

export function PlaybookPerformanceDashboard() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [sortBy, setSortBy] = useState<"score" | "recovered">("recovered");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/playbooks/performance");
      if (res.ok) {
        const d = await res.json();
        setPlaybooks(d.playbooks ?? []);
      }
    } catch {
      setPlaybooks([]);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sorted = [...playbooks].sort((a, b) => {
    if (sortBy === "score") return b.performanceScore - a.performanceScore;
    return b.recoveredAmount - a.recoveredAmount;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[color:var(--rg-text)]">Playbook Performance</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSortBy("recovered")}
            className={`rounded px-2 py-1 text-xs font-medium ${
              sortBy === "recovered" ? "bg-[color:var(--rg-primary)]/20 text-[color:var(--rg-primary)]" : ""
            }`}
          >
            By value
          </button>
          <button
            type="button"
            onClick={() => setSortBy("score")}
            className={`rounded px-2 py-1 text-xs font-medium ${
              sortBy === "score" ? "bg-[color:var(--rg-primary)]/20 text-[color:var(--rg-primary)]" : ""
            }`}
          >
            By score
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[color:var(--rg-border)] p-8 text-center text-sm text-[color:var(--rg-text-muted)]">
          No playbooks enabled yet. Enable a playbook to see performance here.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((p) => (
            <PlaybookPerformanceCard key={p.playbookKey} {...p} />
          ))}
        </div>
      )}
    </div>
  );
}
