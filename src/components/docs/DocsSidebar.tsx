"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import type { DocsNavGroup } from "@/lib/docs/docTypes";
import { cn } from "@/lib/cn";

export function DocsSidebar(props: {
  nav: DocsNavGroup[];
  className?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] lg:hidden"
        aria-label={open ? "Close sidebar" : "Open sidebar"}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-hidden
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          "w-[260px] shrink-0 border-r border-[var(--border)] bg-[var(--bg-surface)]",
          "fixed inset-y-0 left-0 z-40 pt-16 transition-transform lg:static lg:z-auto lg:pt-0",
          "lg:sticky lg:top-0 lg:h-screen lg:max-h-screen lg:overflow-y-auto",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          props.className
        )}
      >
        <nav className="p-4 lg:p-6" aria-label="Documentation">
          {props.nav.map((group) => (
            <div key={group.section} className="mb-8">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {group.section}
              </p>
              <ul className="space-y-1">
                {group.items.map((doc) => {
                  const active =
                    pathname === doc.href ||
                    (doc.href !== "/docs" && pathname.startsWith(doc.href + "/"));
                  return (
                    <li key={doc.href}>
                      <Link
                        href={doc.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "block rounded-lg px-3 py-2 text-sm",
                          active
                            ? "bg-[var(--primary)]/10 font-medium text-[var(--primary)]"
                            : "text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]"
                        )}
                      >
                        {doc.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
