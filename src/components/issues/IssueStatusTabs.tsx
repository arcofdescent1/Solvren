"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";

type Tab = { key: string; label: string; statuses: string[] };

const TABS: Tab[] = [
  { key: "open", label: "Open", statuses: ["open", "triaged", "assigned", "in_progress"] },
  { key: "assigned", label: "Assigned", statuses: ["assigned", "in_progress"] },
  { key: "pending_verification", label: "Pending verification", statuses: ["resolved"] },
  { key: "verified", label: "Verified", statuses: ["verified"] },
  { key: "dismissed", label: "Dismissed", statuses: ["dismissed"] },
];

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
      {TABS.map((tab) => {
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

export function getStatusTabFromParam(statusParam: string | null): string {
  if (!statusParam) return "open";
  const t = TABS.find((tab) => tab.key === statusParam);
  return t?.key ?? "open";
}

export function getStatusesForTab(tabKey: string): string[] {
  const t = TABS.find((tab) => tab.key === tabKey);
  return t?.statuses ?? TABS[0].statuses;
}
