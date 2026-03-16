"use client";

import { useEffect, useState } from "react";
import { NextActionsPanel, type NextActionItem } from "./NextActionsPanel";

export function NextActionsPanelClient() {
  const [actions, setActions] = useState<NextActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/next-actions")
      .then((r) => r.json())
      .then((json) => setActions(Array.isArray(json.actions) ? json.actions : []))
      .catch(() => setActions([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-6">
        <h2 className="font-semibold text-lg">My next actions</h2>
        <div className="mt-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-[var(--bg-muted)]" />
          ))}
        </div>
      </div>
    );
  }

  return <NextActionsPanel actions={actions} />;
}
