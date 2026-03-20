"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LayoutGrid, Bookmark } from "lucide-react";

const PRESETS: { key: string; label: string; href: string }[] = [
  { key: "exec", label: "Exec", href: "/issues?severity=high&status=open" },
  { key: "revops", label: "RevOps", href: "/issues?domain_key=revops" },
  { key: "engineering", label: "Engineering", href: "/issues?source_type=detector" },
  { key: "my-queue", label: "My Queue", href: "/issues?assignee=me" },
];

export function IssuesSavedViews() {
  const searchParams = useSearchParams();
  const currentQuery = searchParams.toString();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
        <Bookmark className="h-3.5 w-3.5" aria-hidden />
        Saved views
      </span>
      {PRESETS.map((p) => {
        const presetQuery = new URL(p.href, "http://x").searchParams.toString();
        const isActive =
          currentQuery.length > 0 &&
          presetQuery.length > 0 &&
          new URLSearchParams(currentQuery).toString() === new URLSearchParams(presetQuery).toString();
        return (
          <Link
            key={p.key}
            href={p.href}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              isActive
                ? "bg-[var(--primary)] text-[var(--primary-fg)]"
                : "bg-[var(--bg-muted)] text-[var(--text)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            <LayoutGrid className="h-3 w-3" aria-hidden />
            {p.label}
          </Link>
        );
      })}
    </div>
  );
}
