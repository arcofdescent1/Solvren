"use client";

import { useState } from "react";
import { Card, CardBody } from "@/ui";

type DeadLetter = {
  id: string;
  provider: string;
  dead_letter_type: string;
  reason_code: string;
  reason_message: string;
  retryable: boolean;
  status: string;
  created_at: string;
};

export function DeadLetterQueueClient({ deadLetters }: { deadLetters: DeadLetter[] }) {
  const [retrying, setRetrying] = useState<string | null>(null);
  const [ignoring, setIgnoring] = useState<string | null>(null);

  const handleRetry = async (id: string) => {
    setRetrying(id);
    try {
      const res = await fetch(`/api/admin/integrations/dead-letters/${id}/retry`, { method: "POST" });
      if (res.ok) window.location.reload();
    } finally {
      setRetrying(null);
    }
  };

  const handleIgnore = async (id: string) => {
    const reason = prompt("Reason for ignoring (required):");
    if (!reason) return;
    setIgnoring(id);
    try {
      const res = await fetch(`/api/admin/integrations/dead-letters/${id}/ignore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) window.location.reload();
    } finally {
      setIgnoring(null);
    }
  };

  if (deadLetters.length === 0) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-[var(--text-muted)]">No open dead letters.</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <ul className="space-y-4">
          {deadLetters.map((d) => (
            <li key={d.id} className="border-b border-[var(--border)] pb-4 last:border-0 last:pb-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">
                    {d.provider} · {d.dead_letter_type}
                  </p>
                  <p className="text-sm text-[var(--text-muted)] mt-1">{d.reason_code}: {d.reason_message}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    {new Date(d.created_at).toLocaleString()} {d.retryable && "· Retryable"}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {d.retryable && (
                    <button
                      onClick={() => handleRetry(d.id)}
                      disabled={!!retrying}
                      className="rounded bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {retrying === d.id ? "…" : "Retry"}
                    </button>
                  )}
                  <button
                    onClick={() => handleIgnore(d.id)}
                    disabled={!!ignoring}
                    className="rounded border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--bg-muted)] disabled:opacity-50"
                  >
                    {ignoring === d.id ? "…" : "Ignore"}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
