"use client";;
import { Button } from "@/ui";

import { useState } from "react";

export default function MarkDeliveredButton({
  outboxIds,
  onDone,
}: {
  outboxIds: string[];
  onDone?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function mark() {
    setErr(null);
    setLoading(true);
    try {
      const resp = await fetch("/api/reviews/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "MARK_DELIVERED", outboxIds }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error ?? "Failed to mark delivered");

      if (onDone) onDone();
      else window.location.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        className="px-3 py-1.5 rounded border text-sm"
        onClick={mark}
        disabled={loading || outboxIds.length === 0}
        title="Ops override: mark these deliveries as DELIVERED"
      >
        {loading ? "Marking..." : "Mark delivered"}
      </Button>
      {err ? <div className="text-xs text-red-600">{err}</div> : null}
    </div>
  );
}
