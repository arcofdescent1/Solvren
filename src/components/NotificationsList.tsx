"use client";

import { Button } from "@/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

type N = {
  id: string;
  title: string;
  body: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  cta_label: string | null;
  cta_url: string | null;
  read_at: string | null;
  created_at: string;
};

function badgeClass(sev: string) {
  if (sev === "CRITICAL") return "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30";
  if (sev === "WARNING") return "border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30";
  return "border-[var(--border)] bg-[var(--bg-surface-2)]";
}

function relativeTime(created_at: string): string {
  const d = new Date(created_at);
  const now = new Date();
  const sec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (sec < 60) return "Just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return d.toLocaleDateString();
}

function dateGroup(created_at: string): string {
  const d = new Date(created_at);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function NotificationsList({ initial }: { initial: N[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function markRead(id: string) {
    setBusy(id);
    setMsg(null);
    const resp = await fetch("/api/notifications/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setBusy(null);
    if (!resp.ok) {
      const j = await resp.json().catch(() => ({}));
      setMsg((j as { error?: string })?.error ?? "Failed to mark read.");
      return;
    }
    router.refresh();
  }

  async function markAllRead() {
    setBusyAll(true);
    setMsg(null);
    const resp = await fetch("/api/notifications/mark-all-read", {
      method: "POST",
    });
    setBusyAll(false);
    if (!resp.ok) {
      const j = await resp.json().catch(() => ({}));
      setMsg((j as { error?: string })?.error ?? "Failed to mark all read.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button
          onClick={markAllRead}
          disabled={busyAll}
          className="px-3 py-2 rounded border text-sm disabled:opacity-60"
        >
          {busyAll ? "Marking..." : "Mark all read"}
        </Button>
        {msg && <div className="text-xs opacity-70">{msg}</div>}
      </div>
      {initial.length === 0 ? (
        <div className="py-8 text-center text-sm text-[var(--text-muted)]">No notifications yet.</div>
      ) : (
        <div className="space-y-4">
          {(() => {
            const byDay = new Map<string, N[]>();
            for (const n of initial) {
              const day = dateGroup(n.created_at);
              if (!byDay.has(day)) byDay.set(day, []);
              byDay.get(day)!.push(n);
            }
            return Array.from(byDay.entries()).map(([day, items]) => (
              <div key={day}>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  {day}
                </div>
                <div className="space-y-2">
                  {items.map((n) => (
                    <div
                      key={n.id}
                      className={`rounded-lg border p-3 space-y-2 ${badgeClass(n.severity)} ${!n.read_at ? "border-l-4 border-l-[var(--primary)]" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-2 font-semibold text-[var(--text)]">
                          {!n.read_at && (
                            <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]" aria-hidden />
                          )}
                          <span className="truncate">{n.title}</span>
                        </div>
                        <span className="shrink-0 text-xs text-[var(--text-muted)]" title={new Date(n.created_at).toLocaleString()}>
                          {relativeTime(n.created_at)}
                        </span>
                      </div>
                      <div className="text-sm text-[var(--text-muted)]">{n.body}</div>
                      <div className="flex items-center gap-3">
                        {n.cta_url && (
                          <a
                            className="text-sm font-medium text-[var(--primary)] hover:underline"
                            href={n.cta_url}
                            onClick={async (e) => {
                              if (!n.read_at) {
                                e.preventDefault();
                                await markRead(n.id);
                                window.location.href = n.cta_url!;
                              }
                            }}
                          >
                            {n.cta_label ?? "Open"}
                          </a>
                        )}
                        {!n.read_at && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-60"
                            disabled={busy === n.id}
                            onClick={() => markRead(n.id)}
                          >
                            {busy === n.id ? "Marking…" : "Mark read"}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>
      )}
    </div>
  );
}
