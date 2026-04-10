import Link from "next/link";
import { DocsSearch, DocsSidebar, DocsCommandBar, DocsCommandTrigger } from "@/components/docs";
import { DocsAnalyticsProvider } from "@/components/docs/DocsAnalyticsProvider";
import { ThemeToggle } from "@/ui/theme/ThemeToggle";
import { getDocsNav } from "@/lib/docs/getDocsNav";
import { PublicFooter } from "@/components/footer/PublicFooter";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nav = getDocsNav();

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-app)] text-[var(--text)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg-surface)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <Link
                href="/docs"
                className="text-lg font-semibold tracking-tight text-[var(--text)]"
              >
                Solvren Docs
              </Link>
              <nav className="hidden gap-5 text-sm text-[var(--text-muted)] md:flex">
                <Link href="/docs/get-started" className="transition hover:text-[var(--text)]">
                  Get Started
                </Link>
                <Link href="/docs/guides/user-guide" className="transition hover:text-[var(--text)]">
                  Guides
                </Link>
                <Link href="/docs/admin/organization-setup" className="transition hover:text-[var(--text)]">
                  Admin
                </Link>
                <Link href="/docs/security/rbac" className="transition hover:text-[var(--text)]">
                  Security
                </Link>
                <Link href="/docs/uat/seed-data" className="transition hover:text-[var(--text)]">
                  UAT
                </Link>
                <Link href="/docs/architecture/overview" className="transition hover:text-[var(--text)]">
                  Architecture
                </Link>
                <Link href="/docs/releases" className="transition hover:text-[var(--text)]">
                  Releases
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:block">
                <DocsCommandTrigger />
              </div>
              <ThemeToggle />
              <Link
                href="/"
                className="text-sm text-[var(--text-muted)] transition hover:text-[var(--text)]"
              >
                Back to site
              </Link>
              <Link
                href="/login"
                className="rounded-xl border border-[var(--border)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-contrast)] transition hover:brightness-95"
              >
                Sign in
              </Link>
            </div>
          </div>
          <DocsSearch placeholder="Search setup, guides, security, UAT, architecture..." />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <DocsSidebar nav={nav} />
        <main className="min-w-0 flex-1 px-4 py-8 lg:px-8 text-[var(--text)]">
          {children}
        </main>
      </div>
      <PublicFooter />
      <DocsAnalyticsProvider />
      <DocsCommandBar />
    </div>
  );
}
