"use client";

import * as React from "react";
import { Container } from "./container";
import { useLayout } from "./LayoutContext";
import { cn } from "@/lib/cn";

export function Content({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { sidebarOpen } = useLayout();
  return (
    <div
      className={cn(
        "min-h-screen pt-[var(--topbar-height)] transition-[padding] duration-200",
        sidebarOpen ? "lg:pl-[var(--sidenav-width)]" : "lg:pl-0",
        className
      )}
      {...props}
    >
      <Container className="py-6">{children}</Container>
    </div>
  );
}
