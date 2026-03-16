import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function DocsBreadcrumbs(p: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-6 flex items-center gap-1 text-sm text-[var(--text-muted)]"
    >
      {p.items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-subtle)]" />}
          {item.href ? (
            <Link href={item.href} className="text-[var(--primary)] hover:text-[var(--primary-hover)]">
              {item.label}
            </Link>
          ) : (
            <span className="text-[var(--text)]">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
