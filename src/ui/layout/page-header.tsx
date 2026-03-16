import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/** SB Admin Pro-style page header with optional breadcrumbs, tabs, and action area. */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  tabs,
  actions,
  right,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  tabs?: React.ReactNode;
  actions?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  const actionArea = actions ?? right;
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4",
        className
      )}
    >
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav className="flex items-center gap-1 text-sm text-[var(--text-muted)]">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1">
              {b.href ? (
                <Link href={b.href} className="hover:text-[var(--primary)]">
                  {b.label}
                </Link>
              ) : (
                <span>{b.label}</span>
              )}
              {i < breadcrumbs.length - 1 ? (
                <span className="text-[var(--border)]">/</span>
              ) : null}
            </span>
          ))}
        </nav>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {description}
            </p>
          ) : null}
          {tabs ? <div className="mt-3">{tabs}</div> : null}
        </div>
        {actionArea ? (
          <div className="flex shrink-0 items-center gap-2">
            {actionArea}
          </div>
        ) : null}
      </div>
    </div>
  );
}
