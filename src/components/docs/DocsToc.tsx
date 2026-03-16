"use client";

import Link from "next/link";
import type { TocItem } from "@/lib/docs/docTypes";

export function DocsToc(p: { items: TocItem[] }) {
  if (!p.items.length) return null;
  return (
    <nav aria-label="On this page" className="sticky top-24 hidden w-[220px] shrink-0 lg:block">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        On this page
      </p>
      <ul className="space-y-2 border-l border-[var(--border)] pl-4 text-sm">
        {p.items.map((item) => (
          <li key={item.id} style={{ paddingLeft: item.level === 3 ? 12 : 0 }}>
            <Link
              href={"#" + item.id}
              className="block py-1 text-[var(--text-muted)] hover:text-[var(--primary)]"
            >
              {item.text}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
