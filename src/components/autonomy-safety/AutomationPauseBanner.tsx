"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Container } from "@/ui";

export type PauseInfo = {
  id: string;
  pauseType: string;
  reason: string;
  scopeType: string;
  scopeRef: string | null;
};

type Props = {
  orgId?: string | null;
  onDismiss?: () => void;
};

export function AutomationPauseBanner({ orgId: _orgId, onDismiss }: Props) {
  const [pauses, setPauses] = useState<PauseInfo[]>([]);

  const fetchPauses = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/autonomy/pauses");
      if (res.ok) {
        const data = await res.json();
        setPauses(data.pauses ?? []);
      }
    } catch {
      setPauses([]);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchPauses();
    });
  }, [fetchPauses]);

  if (pauses.length === 0) return null;

  return (
    <section className="border-b border-[var(--border)] bg-[var(--bg-surface)]">
      <Container className="py-3">
        <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--warning)] bg-[var(--bg-surface-2)] px-4 py-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Badge variant="warning">Automation paused</Badge>
            <p className="text-sm text-[var(--text)]">
              {pauses.length} active pause{pauses.length === 1 ? "" : "s"}: {pauses.map((p) => p.reason).join("; ")}
            </p>
          </div>
          {onDismiss && (
            <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
              Dismiss
            </Button>
          )}
        </div>
      </Container>
    </section>
  );
}
