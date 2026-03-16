import Link from "next/link";

export function DocsCard(p: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={p.href}
      className="block rounded-xl border border-white/10 bg-slate-900/50 p-5 transition hover:border-cyan-400/30 hover:bg-slate-900/80"
    >
      <div className="font-semibold text-white">{p.title}</div>
      <div className="mt-2 text-sm leading-6 text-slate-400">{p.description}</div>
    </Link>
  );
}
