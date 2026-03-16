import * as React from "react";
import { cn } from "@/lib/cn";

export interface SpacerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Size in design tokens (1–8 maps to spacing scale) */
  size?: 1 | 2 | 3 | 4 | 6 | 8 | 12;
  /** Axis: inline adds horizontal space, block adds vertical */
  axis?: "inline" | "block";
}

const sizeClass = {
  block: {
    1: "h-1 min-h-1",
    2: "h-2 min-h-2",
    3: "h-3 min-h-3",
    4: "h-4 min-h-4",
    6: "h-6 min-h-6",
    8: "h-8 min-h-8",
    12: "h-12 min-h-12",
  },
  inline: {
    1: "w-1 min-w-1",
    2: "w-2 min-w-2",
    3: "w-3 min-w-3",
    4: "w-4 min-w-4",
    6: "w-6 min-w-6",
    8: "w-8 min-w-8",
    12: "w-12 min-w-12",
  },
} as const;

export function Spacer({
  className,
  size = 4,
  axis = "block",
  ...props
}: SpacerProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block shrink-0",
        sizeClass[axis][size],
        className
      )}
      {...props}
    />
  );
}
Spacer.displayName = "Spacer";
