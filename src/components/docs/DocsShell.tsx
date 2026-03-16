import Link from "next/link";
import { getDocsNav } from "@/lib/docs/getDocsNav";
import { DocsSidebar } from "./DocsSidebar";

export function DocsShell({ children }: { children: React.ReactNode }) {
  const nav = getDocsNav();

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text)]">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-surface)] px-4 lg:px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/docs"
            className="font-semibold text-[var(--text)] hover:text-[var(--primary)]"
          >
            Solvren Docs
          </Link>
          <Link
            href="/"
            className="hidden text-sm text-[var(--text-muted)] hover:text-[var(--primary)] sm:block"
          >
            Back to product
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="search"
            placeholder="Search docs (coming soon)"
            className="hidden h-9 w-48 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--text-subtle)] sm:block"
            disabled
          />
          <Link
            href="/login"
            className="text-sm text-[var(--primary)] hover:text-[var(--primary-hover)]"
          >
            Log in
          </Link>
        </div>
      </header>

      <div className="flex">
        <DocsSidebar nav={nav} />
        <main className="flex min-w-0 flex-1 justify-center gap-8 px-4 py-8 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
