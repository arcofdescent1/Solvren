"use client";

import * as React from "react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/ui/primitives/tooltip";
import { cn } from "@/lib/cn";

export type FieldWithTooltipProps = {
  label: React.ReactNode;
  tooltip: string;
  children: React.ReactNode;
  id?: string;
  className?: string;
  /** Optional examples rendered below the label */
  examples?: string[];
};

export function FieldWithTooltip({
  label,
  tooltip,
  children,
  id,
  className,
  examples,
}: FieldWithTooltipProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="flex items-center gap-1.5 text-sm font-medium text-[var(--text)]">
        {label}
        <Tooltip>
          <TooltipTrigger
            type="button"
            className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-[var(--text-muted)]/20 text-[10px] font-semibold text-[var(--text-muted)] transition-colors hover:bg-[var(--primary)]/20 hover:text-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50"
            aria-label="Help"
          >
            ⓘ
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </label>
      {examples && examples.length > 0 && (
        <p className="text-xs text-[var(--text-muted)]">
          Examples: {examples.join(" · ")}
        </p>
      )}
      {children}
    </div>
  );
}
