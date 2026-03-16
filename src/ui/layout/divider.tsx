import * as React from "react";
import { cn } from "@/lib/cn";

export interface DividerProps extends React.HTMLAttributes<HTMLHRElement> {
  orientation?: "horizontal" | "vertical";
}

export function Divider({
  className,
  orientation = "horizontal",
  ...props
}: DividerProps) {
  return (
    <hr
      role="separator"
      className={cn(
        "border-[var(--border)]",
        orientation === "horizontal" ? "w-full border-t" : "h-full border-l self-stretch",
        className
      )}
      {...props}
    />
  );
}
Divider.displayName = "Divider";
