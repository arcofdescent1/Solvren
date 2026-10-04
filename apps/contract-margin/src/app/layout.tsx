import type { Metadata } from "next";
import Link from "next/link";
import { DM_Sans, Manrope } from "next/font/google";
import "./globals.css";

const bodyFont = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });
const headingFont = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

export const metadata: Metadata = {
  title: "Solvren | Secure workspace",
  description: "A clear workspace for understanding AI contract economics.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${bodyFont.variable} ${headingFont.variable}`}><body>
    <header className="topbar"><div className="frame topbar-inner">
      <Link className="brand" href="/workspace" aria-label="Solvren home"><span className="brand-mark">S</span>Solvren</Link>
      <nav className="top-links" aria-label="Primary"><Link href="/workspace">Workspace</Link></nav>
    </div></header>
    {children}
  </body></html>;
}
