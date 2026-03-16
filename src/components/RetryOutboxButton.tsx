"use client";;
import { Button } from "@/ui";

import { useState } from "react";

export default function RetryOutboxButton({
  outboxId,
}: {
  outboxId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function retry() {
    setErr(null);
    setLoading(true);
    try {
      const resp = await fetch("/api/reviews/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RETRY_FAILED",
          outboxIds: [outboxId],
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error ?? "Retry failed");

      window.location.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        className="px-3 py-1.5 rounded border text-sm"
        onClick={retry}
        disabled={loading}
      >
        {loading ? "Retrying..." : "Retry failed"}
      </Button>
      {err ? <div className="text-xs text-red-600">{err}</div> : null}
    </div>
  );
}
