import * as React from "react";
import { cn } from "@/lib/cn";

export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of columns (responsive: sm:cols, md:cols, lg:cols) */
  cols?: 1 | 2 | 3 | 4 | 5 | 6 | 12;
  gap?: 2 | 3 | 4 | 6;
}

const colsMap = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
  12: "grid-cols-12",
};

const gapMap = {
  2: "gap-2",
  3: "gap-3",
  4: "gap-4",
  6: "gap-6",
};

export function Grid({
  className,
  cols = 1,
  gap = 4,
  ...props
}: GridProps) {
  return (
    <div
      className={cn(
        "grid",
        colsMap[cols],
        gapMap[gap],
        className
      )}
      {...props}
    />
  );
}
Grid.displayName = "Grid";
