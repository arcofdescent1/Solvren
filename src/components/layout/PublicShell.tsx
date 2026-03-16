import { PublicHeader } from "@/components/marketing/PublicHeader";
import { PublicFooter } from "@/components/marketing/PublicFooter";

/**
 * Single authoritative public/marketing shell.
 * Renders public header, main content area, and footer.
 * No app sidebar or top nav — used for public, auth, and marketing pages.
 */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <PublicHeader />
      <main>{children}</main>
      <PublicFooter />
    </div>
  );
}
