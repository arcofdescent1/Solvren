"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { ISSUE_STATUS_TAB_DEFS } from "./issueStatusTabs.model";

function buildHref(searchParams: URLSearchParams, statusFilter: string | null) {
  const next = new URLSearchParams(searchParams);
  if (statusFilter) next.set("status", statusFilter);
  else next.delete("status");
  next.delete("page");
  return `/issues${next.toString() ? `?${next.toString()}` : ""}`;
}

export function IssueStatusTabs({
  activeTab,
  counts,
}: {
  activeTab: string;
  counts: Record<string, number>;
}) {
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get("status") ?? "";

  return (
    <div className="flex flex-wrap gap-1 border-b border-[var(--border)]">
      {ISSUE_STATUS_TAB_DEFS.map((tab) => {
        const count = counts[tab.key] ?? 0;
        const isActive = activeTab === tab.key;
        const href = buildHref(searchParams, isActive ? null : tab.key);
        return (
          <Link
            key={tab.key}
            href={href}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
            )}
          >
            {tab.label}
            {count > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-xs",
                  isActive ? "bg-[var(--primary)]/20 text-[var(--primary)]" : "bg-[var(--bg-surface-2)] text-[var(--text-muted)]"
                )}
              >
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
