"use client";

import Link from "next/link";
import type { DocsRoleShortcut } from "@/lib/docs/docTypes";
import { trackDocsEvent } from "@/lib/docs/docsAnalytics";

const LABELS: Record<DocsRoleShortcut["role"], string> = {
  owner: "Owner",
  admin: "Admin",
  submitter: "Submitter",
  reviewer: "Reviewer",
  viewer: "Viewer",
  executive: "Executive",
};

export function DocsRoleShortcuts({ shortcuts }: { shortcuts: DocsRoleShortcut[] }) {
  if (!shortcuts.length) return null;
  return (
    <section className="mt-12">
      <h2 className="text-2xl font-semibold text-white">Browse by role</h2>
      <p className="mt-2 max-w-2xl text-sm text-slate-300">Jump to docs relevant to your responsibilities.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shortcuts.map((s) => (
          <Link
            key={s.role}
            href={s.href}
            className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 transition hover:border-white/20 hover:bg-slate-900"
            onClick={() => trackDocsEvent("docs_role_shortcut_click", { role: s.role, href: s.href })}
          >
            <div className="text-xs font-semibold uppercase tracking-wider text-cyan-300">{LABELS[s.role]}</div>
            <div className="mt-2 text-lg font-semibold text-white">{s.title}</div>
            <p className="mt-2 text-sm text-slate-300">{s.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
