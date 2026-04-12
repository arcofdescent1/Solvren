"use client";

import * as React from "react";

type Rec = { id: string; title: string; description: string; confidence: number; gapType: string };

export function ExpansionRecommendations() {
  const [items, setItems] = React.useState<Rec[]>([]);

  React.useEffect(() => {
    void (async () => {
      const res = await fetch("/api/onboarding/phase4/recommendations");
      const j = (await res.json()) as { recommendations?: Rec[] };
      setItems(j.recommendations ?? []);
    })();
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="space-y-2 rounded-lg border border-[color:var(--rg-border)] bg-[color:var(--rg-surface)] p-4">
      <h3 className="text-sm font-semibold text-[color:var(--rg-text)]">Expansion recommendations</h3>
      <ul className="space-y-2">
        {items.map((r) => (
          <li key={r.id} className="rounded-md border border-[color:var(--rg-border)] p-3 text-xs">
            <p className="font-medium text-[color:var(--rg-text)]">{r.title}</p>
            <p className="mt-1 text-[color:var(--rg-text-muted)]">{r.description}</p>
            <p className="mt-1 text-[color:var(--rg-text-muted)]">
              Gap: {r.gapType} · Confidence {(r.confidence * 100).toFixed(0)}%
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
