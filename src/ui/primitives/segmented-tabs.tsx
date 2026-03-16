import * as React from "react";
import { cn } from "@/lib/cn";

export type SegmentedTab = { id: string; label: React.ReactNode; badge?: React.ReactNode; disabled?: boolean };

export function SegmentedTabs({
  tabs,
  value,
  onValueChange,
  className,
}: {
  tabs: SegmentedTab[];
  value: string;
  onValueChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface)] p-1 shadow-[var(--shadow-sm)]",
        className
      )}
    >
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            disabled={t.disabled}
            onClick={() => onValueChange(t.id)}
            className={cn(
              "px-3 py-2 text-sm font-semibold rounded-[calc(var(--radius-md)-2px)] transition-colors disabled:opacity-50",
              active
                ? "bg-[var(--primary)] text-white shadow-sm"
                : "text-[var(--text)] hover:bg-[var(--bg-surface-2)]"
            )}
          >
            <span className="inline-flex items-center gap-2">
              {t.label}
              {t.badge}
            </span>
          </button>
        );
      })}
    </div>
  );
}
