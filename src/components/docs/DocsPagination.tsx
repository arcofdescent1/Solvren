import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function DocsPagination(p: {
  prev?: { title: string; href: string } | null;
  next?: { title: string; href: string } | null;
}) {
  if (!p.prev && !p.next) return null;
  return (
    <nav
      aria-label="Documentation pagination"
      className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--border)] pt-8"
    >
      {p.prev ? (
        <Link
          href={p.prev.href}
          className="flex items-center gap-2 text-[var(--primary)] hover:text-[var(--primary-hover)]"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="text-sm">{p.prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {p.next ? (
        <Link
          href={p.next.href}
          className="flex items-center gap-2 text-[var(--primary)] hover:text-[var(--primary-hover)]"
        >
          <span className="text-sm">{p.next.title}</span>
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
