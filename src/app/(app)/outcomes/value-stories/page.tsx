"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeaderV2, Stack } from "@/ui";
import { ValueStoryCard } from "@/components/outcomes/ValueStoryCard";

type Item = {
  id: string;
  headline: string;
  outcome_type: string;
  estimated_value: number;
  confidence_level: string;
  status: string;
  finalized_at?: string | null;
};

export default function ValueStoriesListPage() {
  const sp = useSearchParams();
  const orgId = sp.get("orgId");
  const [items, setItems] = useState<Item[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const q = orgId ? `?orgId=${encodeURIComponent(orgId)}` : "";
    const res = await fetch(`/api/outcomes/value-stories${q}`, { credentials: "include" });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(j.error ?? res.statusText);
      return;
    }
    setErr(null);
    const j = (await res.json()) as { items: Item[] };
    setItems(j.items ?? []);
  }, [orgId]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  return (
    <Stack gap={6} className="pb-10">
      <PageHeaderV2
        title="Value stories"
        description="Paginated list of ROI narratives and eligibility states."
        actions={
          <Link href="/outcomes" className="text-sm font-medium text-[var(--primary)] hover:underline">
            ← Outcomes
          </Link>
        }
      />
      {err ? <p className="text-sm text-[var(--danger)]">{err}</p> : null}
      <Stack gap={3}>
        {items.map((s) => (
          <ValueStoryCard key={s.id} story={s} />
        ))}
      </Stack>
    </Stack>
  );
}
