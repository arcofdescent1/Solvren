"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export type FeedItem = {
  timestamp: string;
  event_type: string;
  system: string;
  description: string;
  severity: "info" | "warning" | "high" | "success";
};

export function ActivityTimeline({ orgId, limit = 15, className }: { orgId: string | null; limit?: number; className?: string }) {
  const [feed, setFeed] = React.useState<FeedItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!orgId) { setLoading(false); setFeed([]); return; }
    let cancelled = false;
    setLoading(true);
    fetch("/api/activity-feed?orgId=" + encodeURIComponent(orgId) + "&limit=" + limit)
      .then((r) => r.json())
      .then((json) => { if (!cancelled) setFeed(Array.isArray(json.feed) ? json.feed : []); })
      .catch(() => { if (!cancelled) setFeed([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orgId, limit]);

  if (!orgId) return null;

  const sev: Record<string, string> = { high: "border-l-[var(--danger)]", warning: "border-l-[var(--warning)]", success: "border-l-emerald-500", info: "border-l-[var(--primary)]" };

  return (
    <div className={cn("space-y-3", className)}>
      <h3 className="text-sm font-semibold text-[var(--text)]">Revenue Risk Activity</h3>
      {loading ? (
        <div className="space-y-2">{[1,2,3,4,5].map((i) => <div key={i} className="h-12 animate-pulse rounded border border-[var(--border)] bg-[var(--bg-surface)]" />)}</div>
      ) : feed.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No recent activity.</p>
      ) : (
        <ul className="space-y-2">
          {feed.map((item, i) => (
            <li key={i} className={cn("rounded border border-[var(--border)] border-l-4 bg-[var(--bg-surface)] p-3 text-sm hover:shadow-sm", sev[item.severity] ?? sev.info)}>
              <p className="text-xs text-[var(--text-muted)]">{new Date(item.timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} · {item.system}</p>
              <p className="mt-0.5 text-[var(--text)]">{item.description}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
