"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import type { ExecutiveChangeView } from "@/lib/executive/types";
import { cn } from "@/lib/cn";

export function TechnicalDetailsDrawer({ view }: { view: ExecutiveChangeView }) {
  const [open, setOpen] = React.useState(false);

  return (
    <section className="border-t border-[var(--border)] pt-8" data-testid="technical-details-section">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-surface-2)] px-4 py-3 text-left text-sm font-semibold text-[var(--text)]"
        aria-expanded={open}
      >
        Show technical details
        <ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="mt-4 space-y-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--text)]">
          <div>
            <div className="font-semibold">Risk signals</div>
            <ul className="mt-1 list-inside list-disc text-[var(--text-muted)]">
              {view.technicalDetails.signals.length ? (
                view.technicalDetails.signals.map((s) => <li key={s.key}>{s.key}</li>)
              ) : (
                <li className="list-none">None recorded</li>
              )}
            </ul>
          </div>
          <div>
            <div className="font-semibold">Linked incidents</div>
            <ul className="mt-1 list-inside list-disc text-[var(--text-muted)]">
              {view.technicalDetails.incidents.length ? (
                view.technicalDetails.incidents.map((i) => (
                  <li key={i.id}>
                    Incident · status {i.status ?? "unknown"}
                  </li>
                ))
              ) : (
                <li className="list-none">None</li>
              )}
            </ul>
          </div>
          <div>
            <div className="font-semibold">Recent audit notes</div>
            <ul className="mt-1 space-y-1 text-[var(--text-muted)]">
              {view.technicalDetails.notes.slice(0, 8).map((n, idx) => (
                <li key={idx}>
                  {n.action} · {n.at ? new Date(n.at).toLocaleString() : ""}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <p className="sr-only" data-testid="technical-details-collapsed">
          Technical details are collapsed
        </p>
      )}
    </section>
  );
}
