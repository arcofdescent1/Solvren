"use client";

import { CircleHelp } from "lucide-react";
import { useState } from "react";
import { trackAppEvent } from "@/lib/appAnalytics";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/ui";

type Props = {
  content: string;
  eventName: "tooltip_open" | "metric_help_open" | "status_help_open";
  payload: Record<string, unknown>;
  label: string;
};

export function InfoTooltip({ content, eventName, payload, label }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-flex items-center text-[var(--text-muted)] hover:text-[var(--text)]"
          onClick={() => {
            setOpen((v) => !v);
            trackAppEvent(eventName, payload);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              setOpen(true);
              trackAppEvent(eventName, payload);
            }
          }}
        >
          <CircleHelp className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{content}</TooltipContent>
    </Tooltip>
  );
}
