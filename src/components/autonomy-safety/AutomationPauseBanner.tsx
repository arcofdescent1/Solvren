"use client";

/**
 * Phase 9 — Automation pause banner (§16.4).
 */
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/ui/primitives/badge";

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

export function AutomationPauseBanner({ orgId, onDismiss }: Props) {
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
    <div className="flex items-center justify-between gap-3 border-b border-[color:var(--rg-warning)]/30 bg-[color:var(--rg-warning)]/5 px-4 py-2">
      <div className="flex items-center gap-2">
        <Badge variant="warning">AUTOMATION PAUSED</Badge>
        <span className="text-sm text-[color:var(--rg-text)]">
          {pauses.length} active pause(s): {pauses.map((p) => p.reason).join("; ")}
        </span>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-[color:var(--rg-text-muted)] hover:underline"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
