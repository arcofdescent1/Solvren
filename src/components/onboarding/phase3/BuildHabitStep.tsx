"use client";

import { useCallback, useEffect, useState } from "react";
import { Stack } from "@/ui";

export function BuildHabitStep(props: {
  interactionCount: number;
  activeWeeks: number;
}) {
  const [byType, setByType] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/onboarding/phase3/habit-progress");
    if (!res.ok) return;
    const j = (await res.json()) as { byType: Record<string, number> };
    setByType(j.byType ?? {});
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const needInteractions = Math.max(0, 5 - props.interactionCount);
  const needWeeks = Math.max(0, 2 - props.activeWeeks);

  return (
    <Stack gap={3}>
      <p className="text-sm text-[var(--text-muted)]">
        Your organization has recorded {props.interactionCount} qualifying interactions across {props.activeWeeks} ISO week(s) in the org
        timezone. Target: 5+ interactions and 2+ weeks (dashboard sessions, approvals, alerts, workflows, executive summary opens, value
        stories, integrations — not passive onboarding loads).
      </p>
      <p className="text-sm">
        {needInteractions > 0 ? `${needInteractions} more interaction(s) needed. ` : ""}
        {needWeeks > 0 ? `${needWeeks} more active week(s) needed.` : ""}
        {needInteractions === 0 && needWeeks === 0 ? "Habit milestone satisfied." : ""}
      </p>
      {Object.keys(byType).length > 0 ? (
        <div className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] p-3 text-sm">
          <p className="mb-2 font-medium">Recent breakdown</p>
          <ul className="space-y-1 text-[var(--text-muted)]">
            {Object.entries(byType).map(([k, v]) => (
              <li key={k}>
                {k}: {v}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Stack>
  );
}
