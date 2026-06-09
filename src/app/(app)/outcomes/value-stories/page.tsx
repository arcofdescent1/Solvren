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
  const searchParams = useSearchParams();
  const orgId = searchParams.get("orgId");
  const [items, setItems] = useState<Item[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const query = orgId ? `?orgId=${encodeURIComponent(orgId)}` : "";
    const res = await fetch(`/api/outcomes/value-stories${query}`, { credentials: "include" });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(json.error ?? res.statusText);
      return;
    }
    setErr(null);
    const json = (await res.json()) as { items: Item[] };
    setItems(json.items ?? []);
  }, [orgId]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  return (
    <Stack gap={6} className="pb-10">
      <PageHeaderV2
        breadcrumbs={[{ label: "Proof", href: "/insights" }, { label: "Value stories" }]}
        title="Value stories"
        description="Traceable proof stories showing what Solvren helped protect, resolve, or accelerate."
        actions={
          <Link href="/outcomes" className="text-sm font-medium text-[var(--primary)] hover:underline">
            Back to executive proof
          </Link>
        }
      />
      {err ? <p className="text-sm text-[var(--danger)]">{err}</p> : null}
      <Stack gap={3}>
        {items.map((story) => (
          <ValueStoryCard key={story.id} story={story} />
        ))}
      </Stack>
    </Stack>
  );
}
