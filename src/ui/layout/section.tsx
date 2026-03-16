import * as React from "react";
import { cn } from "@/lib/cn";

export interface SectionProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Padding variant */
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingMap = {
  none: "",
  sm: "py-4",
  md: "py-6",
  lg: "py-8",
};

export function Section({ className, padding = "md", ...props }: SectionProps) {
  return (
    <section
      className={cn(paddingMap[padding], className)}
      {...props}
    />
  );
}
Section.displayName = "Section";
