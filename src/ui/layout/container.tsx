import * as React from "react";
import { cn } from "@/lib/cn";

/** SB Admin Pro: container-fluid style by default (full width + horizontal padding). Use variant="constrained" for max-width. */
export function Container({
  className,
  variant = "fluid",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "fluid" | "constrained";
}) {
  return (
    <div
      className={cn(
        "w-full px-4 sm:px-6 lg:px-8",
        variant === "constrained" && "mx-auto max-w-screen-2xl",
        className
      )}
      {...props}
    />
  );
}
