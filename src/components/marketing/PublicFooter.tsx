import Link from "next/link";

const socialLinks = [
  { label: "LinkedIn", href: "#" },
  { label: "X", href: "#" },
  { label: "YouTube", href: "#" },
];

export function PublicFooter() {
  return (
    <footer className="relative z-10 border-t border-white/10 bg-slate-950 pt-16 text-slate-300 md:pt-20 lg:pt-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="-mx-4 flex flex-wrap">
          <div className="w-full px-4 md:w-1/2 lg:w-4/12 xl:w-5/12">
            <div className="mb-12 max-w-[380px] lg:mb-16">
              <Link href="/" className="mb-8 inline-flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-500 to-indigo-600 shadow-lg shadow-cyan-500/30">
                  <img src="/images/Solvren.svg" alt="Solvren" className="h-7 w-7 object-contain" />
                </div>
                <div>
                  <div className="text-base font-semibold text-white">Solvren</div>
                  <div className="text-xs uppercase tracking-[0.24em] text-cyan-200/80">Revenue risk intelligence</div>
                </div>
              </Link>
              <p className="mb-9 text-base leading-relaxed text-slate-300">
                Know the financial risk of every pricing, billing, and revenue-impacting system change before it ships.
              </p>
              <div className="flex items-center gap-5 text-sm">
                {socialLinks.map((link) => (
                  <Link key={link.label} href={link.href} className="transition hover:text-cyan-300">
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="w-full px-4 sm:w-1/2 md:w-1/2 lg:w-2/12 xl:w-2/12">
            <div className="mb-12 lg:mb-16">
              <h2 className="mb-10 text-xl font-bold text-white">Product</h2>
              <ul>
                <li>
                  <Link href="/how-it-works" className="mb-4 inline-block text-base transition hover:text-cyan-300">
                    How it works
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="mb-4 inline-block text-base transition hover:text-cyan-300">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/security" className="mb-4 inline-block text-base transition hover:text-cyan-300">
                    Security
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="w-full px-4 sm:w-1/2 md:w-1/2 lg:w-2/12 xl:w-2/12">
            <div className="mb-12 lg:mb-16">
              <h2 className="mb-10 text-xl font-bold text-white">Solutions</h2>
              <ul>
                <li>
                  <Link href="/for-executives" className="mb-4 inline-block text-base transition hover:text-cyan-300">
                    For executives
                  </Link>
                </li>
                <li>
                  <Link href="/for-engineering" className="mb-4 inline-block text-base transition hover:text-cyan-300">
                    For engineering
                  </Link>
                </li>
                <li>
                  <Link href="/for-finance" className="mb-4 inline-block text-base transition hover:text-cyan-300">
                    For finance
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="w-full px-4 md:w-1/2 lg:w-4/12 xl:w-3/12">
            <div className="mb-12 lg:mb-16">
              <h2 className="mb-10 text-xl font-bold text-white">Support & legal</h2>
              <ul>
                <li>
                  <Link href="/login" className="mb-4 inline-block text-base transition hover:text-cyan-300">
                    Sign in
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="mb-4 inline-block text-base transition hover:text-cyan-300">
                    Request beta access
                  </Link>
                </li>
                <li>
                  <Link href="#" className="mb-4 inline-block text-base transition hover:text-cyan-300">
                    Privacy policy
                  </Link>
                </li>
                <li>
                  <Link href="#" className="mb-4 inline-block text-base transition hover:text-cyan-300">
                    Terms of use
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
        <div className="py-8">
          <p className="text-center text-base text-slate-400">
            Solvren helps teams govern revenue-impacting changes with risk intelligence, automated coordination,
            and executive visibility.
          </p>
        </div>
      </div>
      <div className="pointer-events-none absolute right-0 top-14 -z-10 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl"></div>
    </footer>
  );
}
