import type { Metadata } from "next";
import Link from "next/link";
import { DM_Sans, Manrope } from "next/font/google";
import "./globals.css";

const bodyFont = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });
const headingFont = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

export const metadata: Metadata = {
  title: "Solvren | AI contract margin control",
  description: "Trace AI delivery cost to customer contracts, review pricing decisions, and act on margin risk with source evidence.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${bodyFont.variable} ${headingFont.variable}`}><body>
    <header className="topbar"><div className="frame topbar-inner">
      <Link className="brand" href="/" aria-label="Solvren home"><span className="brand-mark">S</span>Solvren</Link>
      <nav className="top-links" aria-label="Primary"><Link href="/pricing">Pricing</Link><Link href="/integrations">Integrations</Link><Link href="/security">Security</Link><Link href="/support">Support</Link><Link href="/workspace">Workspace</Link></nav>
    </div></header>
    {children}
    <footer className="site-footer"><div className="frame footer-inner"><span>© {new Date().getUTCFullYear()} Solvren</span>
      <nav aria-label="Legal and service"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/dpa">DPA</Link><Link href="/subprocessors">Subprocessors</Link><Link href="/status">Status</Link></nav></div></footer>
  </body></html>;
}
