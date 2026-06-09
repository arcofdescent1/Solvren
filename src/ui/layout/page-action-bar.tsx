import * as React from "react";
import { cn } from "@/lib/cn";

export type PageActionBarItem = {
  label: string;
  href: string;
};

export type PageActionBarProps = {
  items?: PageActionBarItem[];
  actions?: React.ReactNode;
  ariaLabel?: string;
  sticky?: boolean;
  className?: string;
};

export function PageActionBar({
  items = [],
  actions,
  ariaLabel = "Page sections",
  sticky = true,
  className,
}: PageActionBarProps) {
  if (items.length === 0 && !actions) return null;

  return (
    <div
      className={cn(
        sticky && "sticky top-[calc(var(--topbar-height)+0.75rem)] z-20",
        "rounded-[var(--radius-lg)] border border-[var(--border)] bg-[color:color-mix(in_oklab,var(--bg-surface)_96%,var(--bg-app))] shadow-sm",
        className
      )}
    >
      <div className="flex flex-col gap-3 px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
        {items.length > 0 ? (
          <nav className="flex min-w-0 flex-wrap gap-1 text-sm" aria-label={ariaLabel}>
            {items.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="inline-flex h-9 items-center rounded-[var(--radius-md)] px-3 font-semibold text-[var(--text-muted)] transition hover:bg-[var(--bg-surface-2)] hover:text-[var(--primary)]"
              >
                {item.label}
              </a>
            ))}
          </nav>
        ) : null}
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
