import * as React from "react";
import { cn } from "@/lib/cn";

export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: "row" | "column";
  align?: "start" | "center" | "end" | "stretch" | "baseline";
  justify?: "start" | "center" | "end" | "between" | "around";
  gap?: 0 | 1 | 2 | 3 | 4 | 6 | 8;
}

const gapMap = {
  0: "gap-0",
  1: "gap-1",
  2: "gap-2",
  3: "gap-3",
  4: "gap-4",
  6: "gap-6",
  8: "gap-8",
};

const alignMap = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
  baseline: "items-baseline",
};

const justifyMap = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
  around: "justify-around",
};

export function Stack({
  className,
  direction = "column",
  align = "stretch",
  justify = "start",
  gap = 3,
  ...props
}: StackProps) {
  return (
    <div
      className={cn(
        "flex",
        direction === "row" ? "flex-row" : "flex-col",
        alignMap[align],
        justifyMap[justify],
        gapMap[gap],
        className
      )}
      {...props}
    />
  );
}
Stack.displayName = "Stack";
